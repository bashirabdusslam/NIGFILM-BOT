import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validFlutterwaveWebhook } from './paymentWebhookSignatures.js';

const paths = [['/api/web/payments/initialize', 'FILM'], ['/api/web/premium/initialize', 'PREMIUM']];
const referencePattern = /^FLW_(FILM|PREMIUM)_(?:(APP)_)?[a-f0-9]{32}$/;
const appReturnUrl = 'com.nigfilm.app://payment-success';

function parseReference(reference) {
  return typeof reference === 'string' ? referencePattern.exec(reference) : null;
}

export function isFlutterwaveReference(reference) {
  return Boolean(parseReference(reference));
}

const handoffLifetime = 10 * 60 * 1000;
const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
const accountTag = (secret, nonce, userId) => hmac(secret, `account:${nonce}:${userId}`);

function makeHandoff(secret, filmId, appUserId, provider) {
  const nonce = randomBytes(16).toString('hex');
  const data = `${filmId}.${Date.now() + handoffLifetime}.${nonce}.${accountTag(secret, nonce, appUserId)}`;
  return `${data}.${hmac(secret, `checkout:${provider}:${data}`)}`;
}

function verifyHandoff(secret, value, filmId, webUserId, provider) {
  if (!secret || typeof value !== 'string' || value.length > 220 ||
      !/^[1-9]\d{0,15}\.\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null;
  const [id, expiry, nonce, tag, signature] = value.split('.');
  if (Number(id) !== filmId || Number(expiry) <= Date.now()) return null;
  const data = `${id}.${expiry}.${nonce}.${tag}`;
  const signatureMatches = scope => timingSafeEqual(Buffer.from(signature), Buffer.from(hmac(secret, scope)));
  if (!signatureMatches(`checkout:${provider}:${data}`) &&
      !(provider === 'flutterwave' && signatureMatches(`checkout:${data}`))) return null;
  const matchesAccount = timingSafeEqual(Buffer.from(tag), Buffer.from(accountTag(secret, nonce, webUserId)));
  return { nonce, matchesAccount };
}

function gatewayKey(env) {
  const key = env.FLUTTERWAVE_SECRET_KEY?.trim();
  const mode = env.FLUTTERWAVE_MODE || 'live';
  if (mode === 'live') return /^FLWSECK-[^\s]+$/.test(key || '') ? key : null;
  if (mode === 'test' && env.NODE_ENV !== 'production' &&
      env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase() !== 'production') {
    return /^FLWSECK_TEST-[^\s]+$/.test(key || '') ? key : null;
  }
  return null;
}

function secureUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function flutterwaveReady({ baseUrl, webUrl, env = process.env }) {
  return Boolean(gatewayKey(env) && env.FLUTTERWAVE_WEBHOOK_SECRET?.trim() &&
    secureUrl(baseUrl) && secureUrl(webUrl));
}

export function registerFlutterwave({
  app, prisma, requireWebUser, plans, processWebPayment, processPremiumPayment,
  buildWebPaymentPage, baseUrl, webUrl, env = process.env, fetchImpl = fetch,
  getSavedProvider = async () => null,
}) {
  const publicOrigin = secureUrl(baseUrl)?.origin;
  const returnUrl = secureUrl(webUrl)?.href;
  const provider = (path, options = {}) => fetchImpl(`https://api.flutterwave.com/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${gatewayKey(env)}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  async function initialize(req, res, kind, native) {
    const sendError = (status, message) => res.status(status).json({ success: false, message });
    if (!gatewayKey(env) || !env.FLUTTERWAVE_WEBHOOK_SECRET || !publicOrigin || !returnUrl) {
      return sendError(503, 'Flutterwave bai gama saitawa ba.');
    }

    try {
      const webUserId = req.webUser.id;
      const handoffNonce = req.checkoutHandoffNonce;
      let amount, description, orderData, model;
      if (kind === 'FILM') {
        const filmId = Number(req.body?.filmId);
        if (!Number.isSafeInteger(filmId) || filmId <= 0) return sendError(400, 'Film ID bai dace ba.');
        const film = await prisma.film.findUnique({ where: { id: filmId } });
        if (!film) return sendError(404, 'Ba a samu fim ba.');
        if (await prisma.webPurchase.findUnique({ where: { webUserId_filmId: { webUserId, filmId } } })) {
          return res.status(409).json({ success: false, alreadyPurchased: true, message: 'Ka riga ka sayi fim.' });
        }
        amount = film.price;
        description = film.title;
        orderData = { filmId };
        model = prisma.webOrder;
      } else {
        const plan = String(req.body?.plan || '').trim().toUpperCase();
        const allPlans = plans();
        if (!Object.hasOwn(allPlans, plan)) return sendError(400, 'Premium plan bai dace ba.');
        amount = allPlans[plan].amount;
        description = `Premium ${plan}`;
        orderData = { plan };
        model = prisma.premiumOrder;
      }

      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
        return sendError(409, 'Farashin order bai dace ba.');
      }

      const reference = `FLW_${kind}_${native || handoffNonce ? "APP_" : ""}${handoffNonce || randomBytes(16).toString('hex')}`;
      let order;
      try {
        order = await model.create({ data: { ...orderData, webUserId, amount, paymentReference: reference } });
      } catch (error) {
        if (handoffNonce && error?.code === 'P2002') {
          return sendError(409, 'An riga an yi amfani da wannan link. Ka koma app idan kana son sake gwadawa.');
        }
        throw error;
      }
      const response = await provider('/payments', {
        method: 'POST',
        body: JSON.stringify({
          tx_ref: reference, amount, currency: 'NGN', redirect_url: `${publicOrigin}/flutterwave/callback`,
          customer: { email: `webuser${webUserId}@nigfilm.app`, name: req.webUser.fullName, phonenumber: req.webUser.phone },
          customizations: { title: 'NIGFILM', description },
        }),
      });
      const data = await response.json();
      const link = secureUrl(data?.data?.link);
      if (!response.ok || data?.status !== 'success' || !link ||
        !link.hostname.endsWith('.flutterwave.com')) {
        return sendError(502, 'An kasa buɗe Flutterwave. Sake gwadawa.');
      }
      return res.json({ success: true, provider: 'flutterwave', reference, authorizationUrl: link.href,
        order: { id: order.id, amount, status: 'pending' } });
    } catch {
      return sendError(502, 'An kasa fara biyan kuɗi. Sake gwadawa.');
    }
  }

  for (const [path, kind] of paths) {
    app.post(path, async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        req.checkoutProvider = await getSavedProvider();
      } catch {
        return res.status(503).json({ success: false, message: 'An kasa samun saitin biyan kuɗi. Sake gwadawa.' });
      }
      const flutterwave = (req.checkoutProvider ?? env.WEB_PAYMENT_PROVIDER) === 'flutterwave';
      const checkoutProvider = flutterwave ? 'flutterwave' : 'paystack';
      const native = req.body?.returnTo === 'app';
      const legacy = native || req.body?.returnTo == null;
      // The unauthenticated legacy APK gets a signed handoff; no order is created here.
      if ((flutterwave || req.checkoutProvider === 'paystack') && kind === 'FILM' && legacy &&
          env.FLUTTERWAVE_LEGACY_BROWSER_CHECKOUT === 'true' && !req.headers?.authorization && returnUrl) {
        const secret = env.FLUTTERWAVE_LEGACY_HANDOFF_SECRET;
        const filmId = Number(req.body?.filmId);
        const appUserId = Number(req.body?.webUserId);
        if (!secret || secret.length < 32) {
          return res.status(503).json({ success: false, message: 'Ba a gama saitin shafin biyan kuɗi ba.' });
        }
        if (!Number.isSafeInteger(filmId) || filmId <= 0 ||
            !Number.isSafeInteger(appUserId) || appUserId <= 0) {
          return res.status(400).json({ success: false, message: 'Film ko asusun bai dace ba.' });
        }
        const link = new URL(returnUrl);
        link.searchParams.set('buyFilm', String(filmId));
        link.hash = new URLSearchParams({ buyIntent: makeHandoff(secret, filmId, appUserId, checkoutProvider) }).toString();
        return res.set('Cache-Control', 'no-store').json({
          success: true, authorizationUrl: link.href, requiresBrowserSignIn: true,
        });
      }
      const useFlutterwave = flutterwave && (req.checkoutProvider === 'flutterwave' ||
        (native ? env.FLUTTERWAVE_NATIVE_CHECKOUT === 'true' : req.body?.returnTo === 'web'));
      if (kind === 'FILM' && req.body?.browserHandoff !== undefined) {
        return requireWebUser(req, res, () => {
          if (native || env.FLUTTERWAVE_LEGACY_BROWSER_CHECKOUT !== 'true' ||
              (!useFlutterwave && req.checkoutProvider !== 'paystack')) {
            return res.status(409).json({ success: false, message: 'Wannan hanyar biyan kuɗi ba ta aiki yanzu.' });
          }
          const handoff = verifyHandoff(env.FLUTTERWAVE_LEGACY_HANDOFF_SECRET, req.body.browserHandoff, Number(req.body.filmId), req.webUser.id, checkoutProvider);
          if (!handoff) {
            return res.status(403).json({ success: false, message: 'Link ɗin ya ƙare ko bai dace ba. Koma app ka sake danna Buy.' });
          }
          if (!handoff.matchesAccount) {
            return res.status(403).json({ success: false, code: 'HANDOFF_ACCOUNT_MISMATCH',
              message: 'Shiga da asusun NIGFILM da ka yi amfani da shi a app.' });
          }
          req.checkoutHandoffNonce = handoff.nonce;
          return useFlutterwave ? initialize(req, res, kind, native) : next();
        });
      }
      if (!useFlutterwave) return next();
      return requireWebUser(req, res, () => initialize(req, res, kind, native));
    });
  }

  async function settle(reference, transactionId) {
    const match = parseReference(reference);
    const kind = match?.[1];
    const id = String(transactionId ?? '');
    if (!kind || !/^\d{1,20}$/.test(id)) return false;
    const model = kind === 'FILM' ? prisma.webOrder : prisma.premiumOrder;
    const order = await model.findUnique({ where: { paymentReference: reference } });
    if (!order) return false;
    if (!gatewayKey(env)) throw Error('Flutterwave verification unavailable');
    const response = await provider(`/transactions/${id}/verify`);
    if (!response.ok) throw Error('Flutterwave verification unavailable');
    const verified = await response.json();
    if (verified?.status !== 'success') throw Error('Flutterwave verification unavailable');
    const data = verified.data;
    if (String(data?.id) !== id || data?.status !== 'successful' || data?.tx_ref !== reference ||
      data?.currency !== 'NGN' || Number(data?.amount) !== order.amount) return false;

    const processPayment = kind === 'FILM' ? processWebPayment : processPremiumPayment;
    const result = await processPayment({ reference, paidAmount: order.amount * 100 });
    if (!result?.success) throw Error('Flutterwave fulfillment pending');
    return { native: match[2] === 'APP' };
  }

  app.get('/flutterwave/callback', async (req, res) => {
    let payment;
    try {
      payment = await settle(req.query?.tx_ref, req.query?.transaction_id);
    } catch {
      // The webhook can still fulfill this order if the browser callback cannot.
    }
    const success = Boolean(payment);
    return res.set('Cache-Control', 'no-store').status(success ? 200 : 409).send(buildWebPaymentPage({
      success,
      title: success ? 'Payment confirmed' : 'Payment not confirmed yet',
      message: success ? 'An tabbatar da biyan kuɗi. Koma NIGFILM.' :
        'Idan an cire kuɗi, kada ka sake biya. Tuntuɓi customer care da reference na payment.',
      returnUrl: payment?.native ? appReturnUrl : returnUrl,
    }));
  });

  app.post('/flutterwave/webhook', async (req, res) => {
    if (!validFlutterwaveWebhook(req.rawBody, req.headers, env.FLUTTERWAVE_WEBHOOK_SECRET)) return res.sendStatus(401);
    const data = req.body?.data;
    if (req.body?.event !== 'charge.completed' || data?.status !== 'successful') return res.sendStatus(200);
    try {
      if (await settle(data.tx_ref, data.id)) return res.sendStatus(200);
      // Acknowledge other integrations, but allow a retry if our order is not yet verifiable.
      return res.sendStatus(isFlutterwaveReference(data.tx_ref) ? 409 : 200);
    } catch {
      return res.sendStatus(503);
    }
  });
}
