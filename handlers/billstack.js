import crypto from 'node:crypto';
const API = 'https://api.billstack.co/v2';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Reject floating point rounding, malformed values, negatives and overflow.
export function toKobo(value) {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error('Invalid payment amount');
  const kobo = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (kobo <= 0n || kobo > 2147483647n) throw new Error('Payment amount out of range');
  return Number(kobo);
}

export function verifySignature(rawBody, headers, secret, now = Date.now()) {
  const timestamp = headers['x-wiaxy-timestamp'];
  const signature = headers['x-wiaxy-signature-256'];
  if (!secret || !Buffer.isBuffer(rawBody) || typeof timestamp !== 'string' ||
      !/^\d+$/.test(timestamp) || typeof signature !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(signature) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(timestamp + '.').update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

async function apiCall(path, body) {
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.BILLSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  const payload = await response.json();
  if (!response.ok || payload?.status !== true || !payload.data) {
    // Never log credentials, payment URLs, or full upstream responses.
    throw new Error(`Billstack API rejected request (${response.status})`);
  }
  return payload.data;
}

export function registerBillstack({app, prisma, requireWebUser, plans, expiry, baseUrl, webUrl}) {
  const enabled = () => process.env.BILLSTACK_ENABLED === 'true';
  const origin = () => {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') throw new Error('PUBLIC_BASE_URL must use HTTPS');
    return url.origin;
  };

  async function initialize(req, res, kind) {
    try {
      if (!process.env.BILLSTACK_SECRET_KEY) return res.status(503).json({success:false, message:'Billstack bai gama saitawa ba.'});
      const user = req.webUser;
      const returnTo = req.body?.returnTo === 'app' ? 'app' : 'web';
      let amount, filmId, plan;
      if (kind === 'FILM') {
        filmId = Number(req.body?.filmId);
        if (!Number.isSafeInteger(filmId) || filmId <= 0) return res.status(400).json({success:false,message:'Film ID bai dace ba.'});
        const film = await prisma.film.findUnique({where:{id:filmId}});
        if (!film) return res.status(404).json({success:false,message:'Ba a samu film ba.'});
        const owned = await prisma.webPurchase.findUnique({where:{webUserId_filmId:{webUserId:user.id,filmId}}});
        if (owned) return res.status(409).json({success:false,alreadyPurchased:true,message:'Ka riga ka sayi film.'});
        amount = film.price;
      } else {
        plan = String(req.body?.plan || '').trim().toUpperCase();
        if (!Object.hasOwn(plans(), plan)) return res.status(400).json({success:false,message:'Premium plan bai dace ba.'});
        amount = plans()[plan].amount;
      }
      const expectedKobo = toKobo(amount);
      const checkoutOrigin = origin();
      const names = String(user.fullName || '').trim().split(/\s+/).filter(Boolean);
      if (!names.length || !user.phone) return res.status(400).json({success:false,message:'Cika suna da lambar waya a profile.'});
      const reference = `BS_${crypto.randomBytes(24).toString('hex')}`;
      const token = crypto.randomBytes(32).toString('hex');
      const order = await prisma.$transaction(async tx => {
        const created = kind === 'FILM'
          ? await tx.webOrder.create({data:{webUserId:user.id,filmId,amount:Number(amount),status:'pending',paymentReference:reference}})
          : await tx.premiumOrder.create({data:{webUserId:user.id,plan,amount:Number(amount),status:'pending',paymentReference:reference}});
        await tx.billstackPayment.create({data:{orderReference:reference,kind,webUserId:user.id,expectedKobo,tokenHash:hash(token),returnTo}});
        return created;
      });
      return res.json({success:true,provider:'billstack',reference,
        authorizationUrl:`${checkoutOrigin}/billstack/checkout/${token}`,
        order:{id:order.id,amount:order.amount,status:order.status}});
    } catch (error) {
      console.error('BILLSTACK INITIALIZE:', error?.code || error?.name || 'Error');
      return res.status(502).json({success:false,message:'An kasa fara Billstack payment. TuntuÉ“i support idan matsalar ta ci gaba.'});
    }
  }

  // Registered before the existing Paystack handlers. Disabled by default.
  for (const [path,kind] of [['/api/web/payments/initialize','FILM'],['/api/web/premium/initialize','PREMIUM']]) {
    app.post(path, (req,res,next) => {
      if (!enabled()) return next();
      return requireWebUser(req,res,()=>initialize(req,res,kind));
    });
  }

  const findCheckout = async token => /^[a-f0-9]{64}$/.test(String(token || ''))
    ? prisma.billstackPayment.findUnique({where:{tokenHash:hash(token)}}) : null;
  app.post('/billstack/account/:token', async (req,res) => {
    res.set('Cache-Control','private, no-store');
    let payment, claimed = false;
    try {
      if (!enabled() || !process.env.BILLSTACK_SECRET_KEY) return res.sendStatus(503);
      payment = await findCheckout(req.params.token);
      if (!payment) return res.sendStatus(404);
      if (payment.accountNumber) return res.json({success:true});
      const email = String(req.body?.email || '').trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,message:'Saka email mai inganci.'});
      const user = await prisma.webUser.findUnique({where:{id:payment.webUserId}});
      const names = String(user?.fullName || '').trim().split(/\s+/).filter(Boolean);
      if (!names.length || !user?.phone) return res.status(400).json({success:false,message:'Cika suna da waya a profile.'});
      const bank = process.env.BILLSTACK_BANK || '9PSB';
      if (!['9PSB','SAFEHAVEN','PROVIDUS'].includes(bank)) throw new Error('Unsupported bank');
      const claim = await prisma.billstackPayment.updateMany({where:{id:payment.id,status:'CREATING'},data:{status:'RESERVING'}});
      if (claim.count !== 1) return res.status(409).json({success:false,message:'Ana duba account. Sake buÉ—e shafin daga baya; kada ka sake payment.'});
      claimed = true;
      const account = await apiCall('/thirdparty/generateVirtualAccount/', {
        reference:payment.orderReference,email,phone:user.phone,firstName:names[0],lastName:names.slice(1).join(' ') || names[0],bank,
      });
      const details = account.account?.[0];
      if (!account.reference || !details?.account_number || !details?.bank_name || !details?.account_name) throw new Error('Incomplete account details');
      await prisma.billstackPayment.update({where:{id:payment.id},data:{
        accountReference:String(account.reference),accountNumber:String(details.account_number),
        accountName:String(details.account_name),bankName:String(details.bank_name),status:'PENDING',
      }});
      return res.json({success:true});
    } catch (error) {
      // A timeout may mean the account exists. Never generate a second account automatically.
      if (claimed) await prisma.billstackPayment.update({where:{id:payment.id},data:{status:'SETUP_REVIEW'}}).catch(()=>{});
      console.error('BILLSTACK ACCOUNT:',error?.code || error?.name || 'Error');
      return res.status(502).json({success:false,message:'An kasa shirya account. TuntuÉ“i support kafin sake gwadawa.'});
    }
  });
  app.get('/billstack/status/:token', async (req,res) => {
    res.set('Cache-Control','private, no-store');
    try {
      const payment = await findCheckout(req.params.token);
      if (!payment) return res.status(404).json({success:false});
      return res.json({success:true,status:payment.status});
    } catch { return res.status(503).json({success:false}); }
  });
  app.get('/billstack/checkout/:token', async (req,res) => {
    res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
    try {
      const payment = await findCheckout(req.params.token);
      if (!payment) return res.status(404).send('Payment bai samu ba.');
      const returnUrl = payment.returnTo === 'app' ? 'com.nigfilm.app://payment-success' : webUrl;
      const nonce = crypto.randomBytes(16).toString('base64');
      res.set('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
      if (!payment.accountNumber) {
        const canCreate = payment.status === 'CREATING';
        return res.type('html').send(`<!doctype html><html lang="ha"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NIGFILM payment</title><style>body{background:#080808;color:white;font:18px Arial;padding:24px}main{max-width:440px;margin:auto}input,button{font:inherit;padding:14px;max-width:100%;margin:12px 0}button{background:#d4af37;border:0}</style><main><h1>NIGFILM</h1><p>Payment: â‚¦${(payment.expectedKobo/100).toFixed(2)}</p>${canCreate ? '<label for="email">Email É—inka</label><input id="email" type="email" maxlength="254" autocomplete="email" required><button id="create">Samar da account na transfer</button>' : '<p>Account yana bukatar dubawa. TuntuÉ“i support kafin sake payment.</p>'}<p id="status"></p></main><script nonce="${nonce}">const button=document.getElementById('create');button?.addEventListener('click',async()=>{const email=document.getElementById('email');if(!email.reportValidity())return;button.disabled=true;const status=document.getElementById('status');status.textContent='Ana shirya accountâ€¦';try{const r=await fetch('/billstack/account/${req.params.token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim()})});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'An samu matsala.');location.reload()}catch(e){status.textContent=e.message;button.disabled=false}});</script></html>`);
      }
      return res.type('html').send(`<!doctype html><html lang="ha"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NIGFILM payment</title><style>body{background:#080808;color:#fff;font:18px Arial;padding:24px}main{max-width:440px;margin:32px auto;padding:24px;background:#151515;border-radius:18px}h1{color:#d4af37}strong{display:block;font-size:28px;margin:16px 0}a{display:inline-block;background:#d4af37;color:#111;padding:14px;border-radius:10px;text-decoration:none}p{line-height:1.5}</style><main><h1>NIGFILM</h1><p>Ka tura â‚¦${(payment.expectedKobo/100).toFixed(2)} zuwa:</p><p>${esc(payment.bankName)}</p><strong>${esc(payment.accountNumber)}</strong><p>${esc(payment.accountName)}</p><p>Ka yi amfani da wannan account domin wannan order kawai. Kada ka sake biya idan ka riga ka tura kuÉ—in.</p><p id="status">Ana jiran tabbatar da paymentâ€¦</p><a href="${esc(returnUrl)}">Komawa NIGFILM</a></main><script nonce="${nonce}">const status=document.getElementById('status');async function check(){try{const r=await fetch('/billstack/status/${req.params.token}',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(d.status==='PAID'){status.textContent='An tabbatar da payment. Ka koma NIGFILM.';return}if(d.status==='REVIEW'){status.textContent='Payment yana bukatar dubawa. TuntuÉ“i support; kada ka sake biya.';return}}catch{status.textContent='Ana sake duba payment. Kada ka sake biya.'}setTimeout(check,6000)}check();</script></html>`);
    } catch { return res.status(503).send('Payment page bai samu ba.'); }
  });

  // A GET health check does not authorize payments.
  app.get('/billstack/webhook', (req,res)=>res.json({success:true,service:'NIGFILM Billstack webhook'}));
  app.post('/billstack/webhook', async (req,res) => {
    if (!verifySignature(req.rawBody, req.headers, process.env.BILLSTACK_SECRET_KEY)) return res.sendStatus(401);
    if (req.body?.event !== 'PAYMENT_NOTIFICATION') return res.json({status:true,message:'successful'});
    const event = req.body.data;
    const sessionId = event?.transaction_ref || event?.wiaxy_ref;
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) return res.sendStatus(400);
    try {
      const verified = await apiCall('/thirdparty/getTransaction/',{session_id:sessionId});
      if (verified.status !== 'SUCCESS') return res.sendStatus(503);
      if ((verified.session_id || verified.transaction_ref) !== sessionId ||
          (verified.currency && verified.currency !== 'NGN')) return res.sendStatus(400);
      const payment = await prisma.billstackPayment.findUnique({where:{accountReference:String(verified.reference || '')}});
      // Old Kolidata accounts must not unlock NIGFILM purchases.
      if (!payment) return res.json({status:true,message:'successful'});
      if (String(verified.nuban || '') !== payment.accountNumber) return res.sendStatus(400);
      const amountKobo = toKobo(verified.amount);
      await fulfillVerifiedPayment(prisma, payment, sessionId, amountKobo, expiry);
      return res.json({status:true,message:'successful'});
    } catch (error) {
      console.error('BILLSTACK WEBHOOK:',error?.code || error?.name || 'Error');
      // Acknowledge only after durable commit. Transient failures must be retried.
      return res.sendStatus(503);
    }
  });
}

export async function fulfillVerifiedPayment(prisma, payment, sessionId, amountKobo, expiry) {
  // Database row locks serialize duplicate webhooks and separate Premium orders for one user.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebUser" WHERE "id" = ${payment.webUserId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "BillstackPayment" WHERE "id" = ${payment.id} FOR UPDATE`;
    const current = await tx.billstackPayment.findUnique({where:{id:payment.id}});
    const receipt = await tx.billstackReceipt.findUnique({where:{sessionId}});
    if (receipt) {
      if (receipt.paymentId !== current.id) throw new Error('Session belongs to another payment');
      return;
    }
    if (current.status === 'PAID' || amountKobo !== current.expectedKobo) {
      await tx.billstackReceipt.create({data:{sessionId,paymentId:current.id,amountKobo,status:'REVIEW'}});
      if (current.status !== 'PAID') await tx.billstackPayment.update({where:{id:current.id},data:{status:'REVIEW'}});
      return;
    }
    const model = current.kind === 'FILM' ? tx.webOrder : current.kind === 'PREMIUM' ? tx.premiumOrder : null;
    if (!model) throw new Error('Unknown order kind');
    const order = await model.findUnique({where:{paymentReference:current.orderReference}});
    if (!order || order.webUserId !== current.webUserId || toKobo(order.amount) !== current.expectedKobo) throw new Error('Order does not match payment');
    if (order.status !== 'paid') {
      if (current.kind === 'FILM') {
        await tx.webPurchase.upsert({where:{webUserId_filmId:{webUserId:order.webUserId,filmId:order.filmId}},
          create:{webUserId:order.webUserId,filmId:order.filmId,orderId:order.id},update:{}});
      } else {
        const now = new Date();
        const active = await tx.premiumSubscription.findFirst({where:{webUserId:order.webUserId,status:'ACTIVE',expiresAt:{gt:now}},orderBy:{expiresAt:'desc'}});
        const startsAt = active ? new Date(active.expiresAt) : now;
        const expiresAt = expiry(order.plan,startsAt);
        if (!expiresAt || !Number.isFinite(expiresAt.getTime())) throw new Error('Invalid premium expiry');
        await tx.premiumSubscription.create({data:{webUserId:order.webUserId,plan:order.plan,status:'ACTIVE',amount:order.amount,paymentReference:order.paymentReference,startsAt,expiresAt}});
      }
      await model.update({where:{id:order.id},data:{status:'paid'}});
    }
    await tx.billstackReceipt.create({data:{sessionId,paymentId:current.id,amountKobo,status:'APPLIED'}});
    await tx.billstackPayment.update({where:{id:current.id},data:{status:'PAID'}});
  }, {timeout:10000});
}
