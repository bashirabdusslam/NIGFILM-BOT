import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { registerFlutterwave } from '../handlers/flutterwave.js';
import { validPaystackWebhook } from '../handlers/paymentWebhookSignatures.js';

test('Paystack accepts signed raw bytes in both formats and rejects stale or tampered events', () => {
  const body = Buffer.from('{"event": "charge.success"}');
  const env = { PAYSTACK_SECRET_KEY: 'test-key', PAYSTACK_WEBHOOK_SECRET: 'whsec_test' };
  const t = 200000;
  const legacy = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
  const modern = createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(t + '.').update(body).digest('hex');
  assert.equal(validPaystackWebhook(body, { 'x-paystack-signature': legacy }, env, t), true);
  const headers = { 'paystack-signature': `t=${t},v1=whk_rotated:${'0'.repeat(128)},v1=whk_test:${modern}` };
  assert.equal(validPaystackWebhook(body, headers, env, t), true);
  assert.equal(validPaystackWebhook(body, headers, env, t + 301), false);
  assert.equal(validPaystackWebhook(Buffer.from('{"event":"charge.success"}'), headers, env, t), false);
  assert.equal(validPaystackWebhook(body, {}, env, t), false);
});

test('Flutterwave selects web checkout, trusts server prices and fulfills only provider-verified payments', async () => {
  const routes = new Map();
  const app = Object.fromEntries(['get','post'].map(method => [method, (path, fn) => routes.set(method + path, fn)]));
  const saved = new Map();
  const grants = [];
  const model = {
    async create({ data }) { if (saved.has(data.paymentReference)) throw Object.assign(Error('Duplicate order'), { code: 'P2002' }); const row = { ...data, id: saved.size + 1 }; saved.set(data.paymentReference, row); return row; },
    async findUnique({ where }) { return saved.get(where.paymentReference); },
  };
  const env = { WEB_PAYMENT_PROVIDER: 'flutterwave', FLUTTERWAVE_SECRET_KEY: 'FLWSECK-example', FLUTTERWAVE_WEBHOOK_SECRET: 'test-signing-key' };
  let verification, checkout;
  registerFlutterwave({
    app, env, baseUrl: 'https://api.example.test', webUrl: 'https://app.example.test',
    prisma: { webOrder: model, premiumOrder: model, film: { findUnique: async () => ({ title: 'Film', price: 200 }) },
      webPurchase: { findUnique: async () => null } },
    requireWebUser: (req, res, next) => req.webUser ? next() : res.sendStatus(401),
    plans: () => ({ WEEKLY: { amount: 1000 } }),
    processWebPayment: async (data) => { grants.push(['film', data]); return { success: true }; },
    processPremiumPayment: async (data) => { grants.push(['premium', data]); return { success: true }; },
    buildWebPaymentPage: (params) => params,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/payments')) {
        checkout = JSON.parse(options.body);
        return { ok: true, json: async () => ({ status: 'success', data: { link: 'https://checkout.flutterwave.com/pay/test' } }) };
      }
      assert.match(url, /\/transactions\/42\/verify$/);
      return { ok: true, json: async () => ({ status: 'success', data: verification }) };
    },
  });

  async function call(method, path, req) {
    const response = { code: 200, status(code) { this.code = code; return this; }, set() { return this; },
      sendStatus(code) { this.code = code; return this; }, json(data) { this.data = data; return this; },
      send(data) { this.data = data; return this; } };
    await routes.get(method + path)(req, response, () => { response.passed = true; });
    return response;
  }
  const webUser = { id: 7, fullName: 'Customer', phone: '08000000000' };
  const path = '/api/web/payments/initialize';
  assert.equal((await call('post', path, { body: { returnTo: 'app' }, webUser })).passed, true);
  const legacyRequest = { body: { webUserId: 7, filmId: 1 } };
  const handoffIntents = new Map();
  assert.equal((await call('post', path, legacyRequest)).passed, true);
  env.FLUTTERWAVE_LEGACY_BROWSER_CHECKOUT = 'true';
  assert.equal((await call('post', path, legacyRequest)).code, 503, 'Handoff requires a signing secret');
  env.FLUTTERWAVE_LEGACY_HANDOFF_SECRET = 'local-test-handoff-secret-at-least-32-chars';
  for (const [filmId, returnTo] of [[1, undefined], [2, 'app']]) {
    const handoff = await call('post', path, { body: { ...legacyRequest.body, filmId, returnTo } });
    assert.equal(handoff.code, 200);
    const handoffUrl = new URL(handoff.data.authorizationUrl);
    assert.equal(handoffUrl.origin + handoffUrl.pathname + handoffUrl.search, `https://app.example.test/?buyFilm=${filmId}`);
    const intent = new URLSearchParams(handoffUrl.hash.slice(1)).get('buyIntent');
    assert.ok(intent);
    handoffIntents.set(filmId, intent);
    assert.equal(handoff.data.requiresBrowserSignIn, true);
  }
  assert.equal(saved.size, 0);
  assert.equal(checkout, undefined);
  assert.equal((await call('post', path, { body: { ...legacyRequest.body, filmId: 0 } })).code, 400);
  assert.equal((await call('post', path, { body: { ...legacyRequest.body, webUserId: null } })).code, 400);
  assert.equal((await call('post', path, { body: { ...legacyRequest.body, returnTo: 'web' } })).code, 401);
  assert.equal((await call('post', '/api/web/premium/initialize', legacyRequest)).passed, true);
  env.FLUTTERWAVE_LEGACY_BROWSER_CHECKOUT = 'false';
  env.WEB_PAYMENT_PROVIDER = 'paystack';
  assert.equal((await call('post', path, { body: { returnTo: 'web' }, webUser })).passed, true);
  env.WEB_PAYMENT_PROVIDER = 'flutterwave';
  assert.equal((await call('post', path, { body: { returnTo: 'web' } })).code, 401);

  const request = { body: { returnTo: 'web', filmId: 1, webUserId: 99, amount: 1 }, webUser };
  env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-example';
  assert.equal((await call('post', path, request)).code, 503, 'Default live mode rejects test keys');
  env.FLUTTERWAVE_MODE = 'test';
  env.RAILWAY_ENVIRONMENT_NAME = 'production';
  assert.equal((await call('post', path, request)).code, 503, 'Railway production rejects test mode');
  assert.equal(saved.size, 0);
  env.FLUTTERWAVE_MODE = 'live';
  env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK-example';
  const film = await call('post', path, request);
  assert.equal(film.code, 200);
  assert.equal(checkout.amount, 200);
  assert.equal(saved.get(film.data.reference).webUserId, 7);
  assert.equal(checkout.redirect_url, 'https://api.example.test/flutterwave/callback');

  const premium = await call('post', '/api/web/premium/initialize', { body: { returnTo: 'web', plan: 'weekly' }, webUser });
  assert.equal(premium.code, 200);
  assert.equal(checkout.amount, 1000);
  assert.equal(grants.length, 0);

  const event = { event: 'charge.completed', data: { id: 42, status: 'successful', tx_ref: film.data.reference } };
  const rawBody = Buffer.from(JSON.stringify(event));
  assert.equal((await call('post', '/flutterwave/webhook', { body: event, rawBody, headers: {} })).code, 401);
  const signed = { body: event, rawBody, headers: { 'verif-hash': env.FLUTTERWAVE_WEBHOOK_SECRET } };
  verification = { ...event.data, currency: 'NGN', amount: 1 };
  assert.equal((await call('post', '/flutterwave/webhook', signed)).code, 409);
  assert.equal(grants.length, 0);
  verification.amount = 200;
  verification.currency = 'USD';
  assert.equal((await call('post', '/flutterwave/webhook', signed)).code, 409);
  assert.equal(grants.length, 0);
  verification.currency = 'NGN';
  env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-example';
  assert.equal((await call('post', '/flutterwave/webhook', signed)).code, 503);
  assert.equal(grants.length, 0, 'Live mode must not fulfill using a test key');
  env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK-example';
  assert.equal((await call('post', '/flutterwave/webhook', signed)).code, 200);
  assert.deepEqual(grants[0], ['film', { reference: film.data.reference, paidAmount: 20000 }]);

  verification = { id: 42, status: 'successful', tx_ref: premium.data.reference, currency: 'NGN', amount: 1000 };
  const callback = await call('get', '/flutterwave/callback', { query: { tx_ref: premium.data.reference, transaction_id: 42 } });
  assert.equal(callback.code, 200);
  assert.deepEqual(grants[1], ['premium', { reference: premium.data.reference, paidAmount: 100000 }]);
  assert.equal(callback.data.returnUrl, 'https://app.example.test/');

  env.FLUTTERWAVE_NATIVE_CHECKOUT = 'true';
  const nativeFilm = await call('post', path, { body: { returnTo: 'app', filmId: 1 }, webUser });
  const nativePremium = await call('post', '/api/web/premium/initialize', { body: { returnTo: 'app', plan: 'weekly' }, webUser });
  assert.match(nativeFilm.data.reference, /^FLW_FILM_APP_[a-f0-9]{32}$/);
  assert.match(nativePremium.data.reference, /^FLW_PREMIUM_APP_[a-f0-9]{32}$/);
  assert.equal((await call('post', path, { body: { returnTo: 'app', filmId: 1 } })).code, 401);

  // Disabling new Flutterwave checkouts must not strand an order already sent to the gateway.
  env.WEB_PAYMENT_PROVIDER = 'paystack';
  env.FLUTTERWAVE_NATIVE_CHECKOUT = 'false';
  verification = { id: 42, status: 'successful', tx_ref: nativePremium.data.reference, currency: 'NGN', amount: 1000 };
  const nativeCallback = await call('get', '/flutterwave/callback', { query: {
    tx_ref: nativePremium.data.reference, transaction_id: 42, returnTo: 'web',
  } });
  assert.equal(nativeCallback.code, 200);
  assert.equal(nativeCallback.data.returnUrl, 'com.nigfilm.app://payment-success');
  assert.deepEqual(grants[2], ['premium', { reference: nativePremium.data.reference, paidAmount: 100000 }]);

  env.WEB_PAYMENT_PROVIDER = 'flutterwave';
  env.FLUTTERWAVE_LEGACY_BROWSER_CHECKOUT = 'true';
  const trialIntent = handoffIntents.get(1);
  const attempt = { body: { returnTo: 'web', filmId: 1, browserHandoff: trialIntent } };
  const before = saved.size;
  assert.equal((await call('post', path, attempt)).code, 401);
  const mismatch = await call('post', path, { ...attempt, webUser: { ...webUser, id: 8 } });
  assert.equal(mismatch.code, 403);
  assert.equal(mismatch.data.code, 'HANDOFF_ACCOUNT_MISMATCH');
  const invalid = await call('post', path, { ...attempt, body: { ...attempt.body, browserHandoff: trialIntent + 'x' }, webUser });
  assert.equal(invalid.code, 403);
  assert.equal(invalid.data.code, undefined, 'An invalid link is not treated as a browser account mismatch');
  assert.equal(saved.size, before);
  const handedOff = await call('post', path, { ...attempt, webUser });
  assert.equal(handedOff.code, 200);
  assert.match(handedOff.data.reference, /^FLW_FILM_APP_[a-f0-9]{32}$/);
  assert.equal(saved.get(handedOff.data.reference).webUserId, 7);
  assert.equal((await call('post', path, { ...attempt, webUser })).code, 409);
  assert.equal(saved.size, before + 1);

});
