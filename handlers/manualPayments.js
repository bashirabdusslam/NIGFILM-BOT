import crypto from 'node:crypto';

export class ManualError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new ManualError(message, status); };
const positiveId = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail('ID bai dace ba.');
  return id;
};
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const keyOf = value => {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) fail('Request key bai dace ba.');
  return value.toLowerCase();
};
export function validateBank(body) {
  if (typeof body.enabled !== 'boolean') fail('Enabled must be true or false.');
  const data = {enabled:body.enabled,bankName:text(body.bankName,100),accountName:text(body.accountName,150),
    accountNumber:text(body.accountNumber,10),instructions:text(body.instructions,1000)};
  // Validate exact original length, so longer account numbers are never silently truncated.
  if (!/^\d{10}$/.test(String(body.accountNumber ?? '').trim()) || !data.bankName || !data.accountName) fail('Saka banki, sunan account da account number mai lambobi 10.');
  return data;
}
export function publicRequest(r) {
  if (!r) return null;
  const fields=['id','reference','webUserId','kind','filmId','plan','title','amount','durationDays','status','source',
    'bankName','accountName','accountNumber','instructions','payerName','verifiedTransferReference','transferReference','userNote','reviewNote',
    'createdBy','reviewedBy','createdAt','submittedAt','reviewedAt'];
  return Object.fromEntries(fields.map(k=>[k,r[k]]));
}
function sameTarget(r, userId, product) {
  return r.webUserId===userId && r.kind===product.kind && r.filmId===product.filmId && r.plan===product.plan;
}
async function productFor(prisma, plans, body) {
  const kind = body.kind;
  if (kind === 'FILM') {
    const filmId=positiveId(body.filmId);
    const film=await prisma.film.findUnique({where:{id:filmId}});
    if (!film) fail('Ba a samu film ba.',404);
    if (!Number.isSafeInteger(film.price) || film.price<0 || film.price>21474836) fail('Farashin film bai dace ba.');
    return {kind,filmId,plan:null,title:film.title,amount:film.price,durationDays:null};
  }
  if (kind !== 'PREMIUM') fail('ZaÉ“i FILM ko PREMIUM.');
  const plan=text(body.plan,20).toUpperCase();
  if (!Object.hasOwn(plans,plan)) fail('Premium plan bai dace ba.');
  const p=plans[plan];
  if (!Number.isSafeInteger(p.amount) || p.amount<=0 || p.amount>21474836 || !Number.isInteger(p.durationDays) || p.durationDays<=0) fail('Premium config bai dace ba.');
  return {kind,filmId:null,plan,title:`${p.name || plan} Premium`,amount:p.amount,durationDays:p.durationDays};
}
// Every manual grant for a user uses this lock, including approval and direct grants.
async function lockUser(tx, userId) {
  await tx.$queryRaw`SELECT "id" FROM "WebUser" WHERE "id" = ${userId} FOR UPDATE`;
  if (!await tx.webUser.findUnique({where:{id:userId}})) fail('Ba a samu user ba.',404);
}

export async function applyManualAccess(tx, r) {
  if (r.kind==='FILM') {
    if (!await tx.film.findUnique({where:{id:r.filmId}})) fail('Film bai samu ba.',404);
    const owned=await tx.webPurchase.findUnique({where:{webUserId_filmId:{webUserId:r.webUserId,filmId:r.filmId}}});
    if (owned) fail('User ya riga ya mallaki film. Duba payment kafin mayar da kuÉ—i.',409);
    const order=await tx.webOrder.create({data:{webUserId:r.webUserId,filmId:r.filmId,amount:r.amount,status:'paid',paymentReference:r.reference}});
    await tx.webPurchase.create({data:{webUserId:r.webUserId,filmId:r.filmId,orderId:order.id}});
  } else if (r.kind==='PREMIUM') {
    const now=new Date();
    const active=await tx.premiumSubscription.findFirst({where:{webUserId:r.webUserId,status:'ACTIVE',expiresAt:{gt:now}},orderBy:{expiresAt:'desc'}});
    const startsAt=active ? new Date(active.expiresAt) : now;
    const expiresAt=new Date(startsAt);
    if (!r.durationDays || !Number.isInteger(r.durationDays)) fail('Premium duration bai dace ba.');
    expiresAt.setDate(expiresAt.getDate()+r.durationDays);
    await tx.premiumOrder.create({data:{webUserId:r.webUserId,plan:r.plan,amount:r.amount,status:'paid',paymentReference:r.reference}});
    await tx.premiumSubscription.create({data:{webUserId:r.webUserId,plan:r.plan,status:'ACTIVE',amount:r.amount,paymentReference:r.reference,startsAt,expiresAt}});
  } else fail('Unknown access kind.');
}

export async function reviewManualRequest(prisma,id,adminId,action,note,confirmed,verifiedReference) {
  const request=await prisma.manualAccessRequest.findUnique({where:{id}});
  if (!request) fail('Request bai samu ba.',404);
  if (!['approve','reject'].includes(action)) fail('Action bai dace ba.');
  if (action==='approve' && confirmed!==true) fail('Sai ka tabbatar kuÉ—i sun shiga account.');
  const verifiedBankRef=text(verifiedReference,150);
  if (action==='approve' && verifiedBankRef.length<3) fail('Saka ainihin bank transaction reference da ka tabbatar.');
  if (action==='reject' && text(note,1000).length<3) fail('Rubuta dalilin Æ™in amincewa.');
  return prisma.$transaction(async tx=>{
    await lockUser(tx,request.webUserId);
    await tx.$queryRaw`SELECT "id" FROM "ManualAccessRequest" WHERE "id" = ${id} FOR UPDATE`;
    const current=await tx.manualAccessRequest.findUnique({where:{id}});
    if (!current) fail('Request bai samu ba.',404);
    if (current.status==='APPROVED' && action==='approve') return current;
    if (current.status==='REJECTED' && action==='reject') return current;
    if (current.status!=='SUBMITTED') fail('Request ba ya jiran amincewa.',409);
    if (action==='approve') {
      const used=await tx.manualAccessRequest.findUnique({where:{verifiedTransferReference:verifiedBankRef}});
      if(used && used.id!==current.id)fail('An riga an yi amfani da wannan bank reference.',409);
      await applyManualAccess(tx,current);
    }
    return tx.manualAccessRequest.update({where:{id},data:{status:action==='approve'?'APPROVED':'REJECTED',
      reviewedBy:adminId,reviewedAt:new Date(),reviewNote:text(note,1000),...(action==='approve'?{verifiedTransferReference:verifiedBankRef}:{})}});
  },{timeout:15000});
}

export function registerManualPayments({app,prisma,requireWebUser,requireAdmin,plans}) {
  const handler=fn=>async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try { await fn(req,res); }
    catch(e){
      console.error('MANUAL PAYMENT:',e?.code || e?.name || 'Error');
      res.status(e instanceof ManualError?e.status:e?.code==='P2002'?409:500).json({success:false,message:e instanceof ManualError?e.message:'An samu matsala. Sake duba status kafin sake gwadawa.'});
    }
  };
  app.get('/api/manual-payment/settings',requireWebUser,handler(async(req,res)=>{
    const s=await prisma.manualPaymentSettings.findUnique({where:{id:1}});
    res.json({success:true,settings:s?.enabled?{enabled:true,bankName:s.bankName,accountName:s.accountName,accountNumber:s.accountNumber,instructions:s.instructions}:{enabled:false}});
  }));
  app.get('/api/admin/manual-payment/settings',requireAdmin,handler(async(req,res)=>{
    const s=await prisma.manualPaymentSettings.findUnique({where:{id:1}});
    res.json({success:true,settings:s?{enabled:s.enabled,bankName:s.bankName,accountName:s.accountName,accountNumber:s.accountNumber,instructions:s.instructions}:null});
  }));
  app.put('/api/admin/manual-payment/settings',requireAdmin,handler(async(req,res)=>{
    const data={...validateBank(req.body || {}),updatedBy:req.webUser.id};
    await prisma.manualPaymentSettings.upsert({where:{id:1},create:{id:1,...data},update:data});
    res.json({success:true});
  }));
  app.post('/api/manual-payment/requests',requireWebUser,handler(async(req,res)=>{
    const userId=req.webUser.id, requestKey=keyOf(req.body?.requestKey);
    const p=await productFor(prisma,plans(),req.body || {});
    const r=await prisma.$transaction(async tx=>{
      await lockUser(tx,userId);
      const old=await tx.manualAccessRequest.findUnique({where:{requestKey}});
      if(old){if(old.source!=='USER'||!sameTarget(old,userId,p))fail('Request key ya riga ya shiga wani order.',409);return old;}
      const settings=await tx.manualPaymentSettings.findUnique({where:{id:1}});
      if(!settings?.enabled)fail('Biyan transfer na admin ba ya aiki yanzu.',503);
      if(p.kind==='FILM' && await tx.webPurchase.findUnique({where:{webUserId_filmId:{webUserId:userId,filmId:p.filmId}}}))fail('Ka riga ka mallaki film.',409);
      // Reopen one pending request for the same product instead of creating extra payment instructions.
      const pending=await tx.manualAccessRequest.findFirst({where:{webUserId:userId,kind:p.kind,filmId:p.filmId,plan:p.plan,source:'USER',status:{in:['PENDING_PAYMENT','SUBMITTED']}},orderBy:{createdAt:'desc'}});
      if(pending)return pending;
      if(await tx.manualAccessRequest.count({where:{webUserId:userId,status:{in:['PENDING_PAYMENT','SUBMITTED']}}})>=10)fail('Kana da buÆ™atu da yawa da ba a gama ba.',429);
      return tx.manualAccessRequest.create({data:{id:crypto.randomUUID(),requestKey,reference:`MAN_${crypto.randomBytes(20).toString('hex')}`,webUserId:userId,...p,
        bankName:settings.bankName,accountName:settings.accountName,accountNumber:settings.accountNumber,instructions:settings.instructions}});
    },{timeout:10000});
    res.json({success:true,request:publicRequest(r)});
  }));
  app.get('/api/manual-payment/requests',requireWebUser,handler(async(req,res)=>{
    const rows=await prisma.manualAccessRequest.findMany({where:{webUserId:req.webUser.id},orderBy:{createdAt:'desc'},take:50});
    res.json({success:true,requests:rows.map(publicRequest)});
  }));
  app.post('/api/manual-payment/requests/:id/submit',requireWebUser,handler(async(req,res)=>{
    const payerName=text(req.body?.payerName,150), transferReference=text(req.body?.transferReference,150), userNote=text(req.body?.userNote,1000);
    if(payerName.length<2 || transferReference.length<3)fail('Saka sunan mai tura kuÉ—i da transfer reference.');
    const count=await prisma.manualAccessRequest.updateMany({where:{id:req.params.id,webUserId:req.webUser.id,status:'PENDING_PAYMENT',source:'USER'},
      data:{payerName,transferReference,userNote,status:'SUBMITTED',submittedAt:new Date()}});
    const r=await prisma.manualAccessRequest.findFirst({where:{id:req.params.id,webUserId:req.webUser.id}});
    if(!r)fail('Request bai samu ba.',404);
    if(!count.count && r.status!=='SUBMITTED')fail('Ba za a sake tura wannan request ba.',409);
    res.json({success:true,request:publicRequest(r)});
  }));
  app.get('/api/admin/manual-payment/requests',requireAdmin,handler(async(req,res)=>{
    const page=Math.max(1,Math.min(10000,Number.parseInt(req.query.page,10)||1));
    const status=text(req.query.status,30);
    if(status && !['SUBMITTED','PENDING_PAYMENT','APPROVED','REJECTED'].includes(status))fail('Status bai dace ba.');
    const where=status?{status}:{};
    const [rows,total]=await Promise.all([prisma.manualAccessRequest.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*30,take:30}),prisma.manualAccessRequest.count({where})]);
    const users=await prisma.webUser.findMany({where:{id:{in:[...new Set(rows.map(r=>r.webUserId))]}},select:{id:true,fullName:true,phone:true}});
    res.json({success:true,page,total,requests:rows.map(r=>({...publicRequest(r),user:users.find(u=>u.id===r.webUserId)||null}))});
  }));
  app.post('/api/admin/manual-payment/requests/:id/:action',requireAdmin,handler(async(req,res)=>{
    const r=await reviewManualRequest(prisma,req.params.id,req.webUser.id,req.params.action,req.body?.note,req.body?.confirmed,req.body?.verifiedTransferReference);
    res.json({success:true,request:publicRequest(r)});
  }));
  app.get('/api/admin/manual-payment/users',requireAdmin,handler(async(req,res)=>{
    const q=text(req.query.q,100);if(q.length<2 && !/^[1-9]\d*$/.test(q))fail('Saka aÆ™alla haruffa biyu ko lambar waya.');
    const numeric=Number(q);
    const users=await prisma.webUser.findMany({where:{OR:[{fullName:{contains:q,mode:'insensitive'}},{phone:{contains:q}},...(Number.isSafeInteger(numeric)&&numeric>0?[{id:numeric}]:[])]},select:{id:true,fullName:true,phone:true},take:20,orderBy:{id:'desc'}});
    res.json({success:true,users});
  }));
  app.post('/api/admin/manual-payment/grants',requireAdmin,handler(async(req,res)=>{
    const userId=positiveId(req.body?.webUserId),requestKey=keyOf(req.body?.requestKey),note=text(req.body?.note,1000);
    if(note.length<5 || req.body?.confirmed!==true)fail('Rubuta dalili sannan ka tabbatar da user da zaÉ“insa.');
    const p=await productFor(prisma,plans(),req.body||{});
    const r=await prisma.$transaction(async tx=>{
      await lockUser(tx,userId);
      const old=await tx.manualAccessRequest.findUnique({where:{requestKey}});
      if(old){if(old.source!=='ADMIN'||old.createdBy!==req.webUser.id||!sameTarget(old,userId,p))fail('Request key ya riga ya shiga wani grant.',409);return old;}
      const created=await tx.manualAccessRequest.create({data:{id:crypto.randomUUID(),requestKey,reference:`GRANT_${crypto.randomBytes(20).toString('hex')}`,webUserId:userId,...p,
        amount:0,status:'APPROVED',source:'ADMIN',createdBy:req.webUser.id,reviewedBy:req.webUser.id,reviewedAt:new Date(),reviewNote:note}});
      await applyManualAccess(tx,created);
      return created;
    },{timeout:15000});
    res.json({success:true,request:publicRequest(r)});
  }));
}
