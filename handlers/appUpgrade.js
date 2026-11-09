import crypto from 'node:crypto';
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(e=>{console.error('NIGFILM upgrade:',e.code||e.name);if(!res.headersSent)res.status(e.status||500).json({success:false,message:e.status?e.message:'An samu matsala. Sake gwadawa.'});});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const idOf=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)fail('ID bai dace ba.');return n;};
const defaults={id:1,whatsappNumber:'',paymentGateway:'PAYSTACK'};
export function validateSettings(body){
 const whatsappNumber=String(body.whatsappNumber||'').replace(/[\s()+-]/g,'');
 if(whatsappNumber&&!/^[1-9]\d{7,14}$/.test(whatsappNumber))fail('Saka WhatsApp number da country code.');
 const paymentGateway=String(body.paymentGateway||'');
 if(!['PAYSTACK','FLUTTERWAVE'].includes(paymentGateway))fail('Zaɓi Paystack ko Flutterwave.');
 return {whatsappNumber,paymentGateway};
}
export function validPayment(data,reference,amount){return data?.status==='successful'&&data.tx_ref===reference&&data.currency==='NGN'&&Number(data.amount)===amount;}
export function validWebhook(raw,headers,secret){
 if(!secret)return false;
 const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
 // Current HMAC signatures and legacy v3 dashboard secret-hash delivery.
 if(headers['flutterwave-signature'])return eq(headers['flutterwave-signature'],crypto.createHmac('sha256',secret).update(raw||Buffer.alloc(0)).digest('base64'));
 return eq(headers['verif-hash'],secret);
}
const downloadSecret=()=>process.env.DOWNLOAD_TICKET_SECRET||process.env.PAYSTACK_SECRET_KEY||process.env.FLUTTERWAVE_SECRET_KEY;
export function createDownloadTicket(userId,filmId,now=Date.now()){
 const secret=downloadSecret();if(!secret)fail('Download bai shirya ba.',503);
 const payload=Buffer.from(JSON.stringify({userId,filmId,expires:now+60000})).toString('base64url');
 return payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('hex');
}
export function readDownloadTicket(ticket,filmId,now=Date.now()){
 const secret=downloadSecret();if(!secret)return null;
 const [payload,signature,...extra]=String(ticket||'').split('.');if(extra.length||!payload||!signature)return null;
 const expected=crypto.createHmac('sha256',secret).update(payload).digest('hex');
 const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const d=JSON.parse(Buffer.from(payload,'base64url').toString());if(d.filmId!==Number(filmId)||!Number.isSafeInteger(d.userId)||d.userId<1||!Number.isFinite(d.expires)||d.expires<=now)return null;return d;}catch{return null;}
}
export function downloadAccess(requireWebUser){return (req,res,next)=>{
 if(req.headers.authorization)return requireWebUser(req,res,next);
 const d=readDownloadTicket(req.query.ticket,req.params.filmId);
 if(!d)return res.status(401).json({success:false,message:'Sake buɗe download daga app.'});
 req.webUser={id:d.userId};next();
};}
export function registerAppUpgrade({app,prisma,requireAdmin,requireWebUser,plans,processWebPayment,processPremiumPayment,buildWebPaymentPage,baseUrl,webUrl}){
 const settings=async()=>await prisma.appSettings.findUnique({where:{id:1}})||defaults;
 const audit=(tx,req,action,target,details={})=>tx.adminAudit.create({data:{adminId:req.webUser.id,action,target:String(target),details}});
 app.get('/api/app-settings',wrap(async(req,res)=>{const s=await settings();res.set('Cache-Control','no-store').json({success:true,whatsappNumber:s.whatsappNumber});}));
 app.get('/api/admin/app-settings',requireAdmin,wrap(async(req,res)=>res.json({success:true,settings:await settings(),configured:{PAYSTACK:!!process.env.PAYSTACK_SECRET_KEY,FLUTTERWAVE:!!process.env.FLUTTERWAVE_SECRET_KEY&&!!process.env.FLUTTERWAVE_WEBHOOK_SECRET}})));
 app.put('/api/admin/app-settings',requireAdmin,wrap(async(req,res)=>{
  const data=validateSettings(req.body);
  if(data.paymentGateway==='FLUTTERWAVE'&&(!process.env.FLUTTERWAVE_SECRET_KEY||!process.env.FLUTTERWAVE_WEBHOOK_SECRET))fail('Saita Flutterwave secret key da webhook secret a server tukuna.');
  if(data.paymentGateway==='PAYSTACK'&&!process.env.PAYSTACK_SECRET_KEY)fail('Saita Paystack secret key a server tukuna.');
  await prisma.$transaction(async tx=>{await tx.appSettings.upsert({where:{id:1},create:{id:1,...data},update:data});await audit(tx,req,'SETTINGS_UPDATED',1,data);});
  res.json({success:true,settings:await settings()});
 }));
 app.get('/api/admin/customer-access',requireAdmin,wrap(async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,100);if(q.length<2)return res.json({success:true,users:[]});
  const users=await prisma.webUser.findMany({where:{OR:[{fullName:{contains:q,mode:'insensitive'}},{phone:{contains:q}},...(/^\d+$/.test(q)?[{id:idOf(q)}]:[])]},select:{id:true,fullName:true,phone:true,premiumSubscriptions:{where:{status:'ACTIVE',expiresAt:{gt:new Date()}},select:{id:true,plan:true,expiresAt:true}}},take:20});res.json({success:true,users});
 }));
 app.post('/api/admin/customer-access/:id/revoke-premium',requireAdmin,wrap(async(req,res)=>{
  const id=idOf(req.params.id);const reason=String(req.body.reason||'').trim().slice(0,500);if(!reason)fail('Rubuta dalilin kashe Premium.');
  const count=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "WebUser" WHERE "id"=${id} FOR UPDATE`;
   if(!await tx.webUser.findUnique({where:{id}}))fail('Ba a samu user ba.',404);
   const result=await tx.premiumSubscription.updateMany({where:{webUserId:id,status:'ACTIVE'},data:{status:'CANCELLED'}});
   await audit(tx,req,'PREMIUM_REVOKED',id,{reason,count:result.count});return result.count;
  });res.json({success:true,count});
 }));
 app.get('/api/admin/film-catalog',requireAdmin,wrap(async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,100),page=Math.max(1,Math.min(100000,Number(req.query.page)||1));
  const where={title:{contains:q,mode:'insensitive'}};
  const [total,films]=await Promise.all([prisma.film.count({where}),prisma.film.findMany({where,orderBy:{id:'desc'},skip:(Math.floor(page)-1)*25,take:25,select:{id:true,title:true,deletedAt:true,_count:{select:{webPurchases:true,purchases:true}}}})]);
  res.json({success:true,total,films});
 }));
 app.post('/api/admin/film-catalog/:id/visibility',requireAdmin,wrap(async(req,res)=>{
  const id=idOf(req.params.id);if(typeof req.body.hidden!=='boolean')fail('Invalid visibility.');
  await prisma.$transaction(async tx=>{await tx.film.update({where:{id},data:{deletedAt:req.body.hidden?new Date():null}});await audit(tx,req,req.body.hidden?'FILM_REMOVED':'FILM_RESTORED',id);});res.json({success:true});
 }));
 app.get('/api/films/:id/comments',wrap(async(req,res)=>{
  const filmId=idOf(req.params.id);if(!await prisma.film.findFirst({where:{id:filmId,deletedAt:null}}))fail('Film baya nan.',404);
  const before=req.query.before?idOf(req.query.before):undefined;
  const rows=await prisma.filmComment.findMany({where:{filmId,...(before?{id:{lt:before}}:{})},orderBy:{id:'desc'},take:21,select:{id:true,body:true,createdAt:true,webUserId:true,user:{select:{fullName:true}}}});
  res.json({success:true,comments:rows.slice(0,20),next:rows.length>20?rows[19].id:null});
 }));
 app.post('/api/films/:id/comments',requireWebUser,wrap(async(req,res)=>{
  const filmId=idOf(req.params.id),body=String(req.body.body||'').trim();if(!body||body.length>1000)fail('Sharhi ya kasance tsakanin haruffa 1 da 1000.');
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "WebUser" WHERE "id"=${req.webUser.id} FOR UPDATE`;
   if(!await tx.film.findFirst({where:{id:filmId,deletedAt:null}}))fail('Film baya nan.',404);
   const recent=await tx.filmComment.count({where:{webUserId:req.webUser.id,createdAt:{gt:new Date(Date.now()-30000)}}});if(recent)fail('Jira daƙiƙa 30 kafin sabon sharhi.',429);
   await tx.filmComment.create({data:{filmId,webUserId:req.webUser.id,body}});
  });res.status(201).json({success:true});
 }));
 app.delete('/api/film-comments/:id',requireWebUser,wrap(async(req,res)=>{
  const id=idOf(req.params.id);const result=await prisma.filmComment.deleteMany({where:{id,...(req.webUser.role==='ADMIN'?{}:{webUserId:req.webUser.id})}});if(!result.count)fail('Ba a samu sharhin ba.',404);res.json({success:true});
 }));
 app.post('/api/web/films/:id/download-ticket',requireWebUser,wrap(async(req,res)=>{
  const filmId=idOf(req.params.id),webUserId=req.webUser.id;
  if(!await prisma.film.findFirst({where:{id:filmId,deletedAt:null}}))fail('An cire wannan fim.',404);
  const [purchase,premium]=await Promise.all([prisma.webPurchase.findUnique({where:{webUserId_filmId:{webUserId,filmId}}}),prisma.premiumSubscription.findFirst({where:{webUserId,status:'ACTIVE',expiresAt:{gt:new Date()}}})]);
  if(!purchase&&!premium)fail('Sai ka sayi fim ko ka kunna Premium.',403);
  const ticket=createDownloadTicket(webUserId,filmId);
  res.set('Cache-Control','no-store').json({success:true,downloadUrl:`${baseUrl}/api/web/movies/${filmId}/download?ticket=${encodeURIComponent(ticket)}`});
 }));
 app.get('/api/web/films/:id/player',requireWebUser,wrap(async(req,res)=>{
  const id=idOf(req.params.id),webUserId=req.webUser.id;
  const film=await prisma.film.findFirst({where:{id,deletedAt:null}});if(!film)fail('An cire wannan fim.',404);
  const now=new Date();const [purchase,premium,ad]=await Promise.all([prisma.webPurchase.findUnique({where:{webUserId_filmId:{webUserId,filmId:id}}}),prisma.premiumSubscription.findFirst({where:{webUserId,status:'ACTIVE',expiresAt:{gt:now}}}),prisma.adMovieUnlock.findFirst({where:{webUserId,filmId:id,status:'UNLOCKED',expiresAt:{gt:now}}})]);
  if(!purchase&&!premium&&!ad)fail('Sai ka sayi fim ko ka kunna Premium.',403);
  let playerUrl=film.webVideoUrl||'';
  if(film.bunnyVideoId){
   let library=process.env.BUNNY_STREAM_LIBRARY_ID;
   // Older films can belong to a different Bunny library; preserve their saved library.
   if(film.webVideoUrl){try{const u=new URL(film.webVideoUrl);const match=u.pathname.match(/^\/embed\/(\d+)\/([^/]+)\/?$/);if(['player.mediadelivery.net','iframe.mediadelivery.net'].includes(u.hostname)&&match&&match[2]===film.bunnyVideoId)library=match[1];}catch{}}
   if(!library)fail('Bunny library bai samu ba.',503);
   playerUrl=`https://player.mediadelivery.net/embed/${encodeURIComponent(library)}/${encodeURIComponent(film.bunnyVideoId)}`;
   const keys=JSON.parse(process.env.BUNNY_STREAM_EMBED_TOKEN_KEYS||'{}');
   const key=keys[library]||(String(library)===String(process.env.BUNNY_STREAM_LIBRARY_ID)?process.env.BUNNY_STREAM_EMBED_TOKEN_KEY:undefined);
   if(key){const expires=Math.floor(Date.now()/1000)+300;const token=crypto.createHash('sha256').update(key+film.bunnyVideoId+expires).digest('hex');playerUrl+=`?token=${token}&expires=${expires}`;}
  }
  if(!playerUrl)fail('Video bai shirya ba.',409);
  res.set('Cache-Control','no-store').json({success:true,playerUrl});
 }));
 const initialize=kind=>wrap(async(req,res)=>{
  const user=req.webUser,s=await settings(),gateway=s.paymentGateway;
  const plan=String(req.body.plan||'').toUpperCase();let film,amount;
  if(kind==='FILM'){
   film=await prisma.film.findFirst({where:{id:idOf(req.body.filmId),deletedAt:null}});if(!film)fail('Film baya nan.',404);
   if(await prisma.webPurchase.findUnique({where:{webUserId_filmId:{webUserId:user.id,filmId:film.id}}}))fail('Ka riga ka sayi fim.',409);amount=film.price;
  }else{if(!plans()[plan])fail('Plan bai dace ba.');amount=plans()[plan].amount;}
  if(!Number.isSafeInteger(amount)||amount<=0||amount>21474836)fail('Farashi bai dace ba.');
  const secret=gateway==='PAYSTACK'?process.env.PAYSTACK_SECRET_KEY:process.env.FLUTTERWAVE_SECRET_KEY;if(!secret)fail('Hanyar biya bata shirya ba.',503);
  const reference=`${kind==='FILM'?'WEB':'PREMIUM'}_${gateway==='FLUTTERWAVE'?'FLW':'PS'}_${crypto.randomBytes(16).toString('hex')}`;
  const returnTo=req.body.returnTo==='app'?'app':'web';
  const order=await prisma.$transaction(async tx=>{
   const row=kind==='FILM'?await tx.webOrder.create({data:{webUserId:user.id,filmId:film.id,amount,status:'pending',paymentReference:reference}}):await tx.premiumOrder.create({data:{webUserId:user.id,plan,amount,status:'pending',paymentReference:reference}});
   await tx.checkoutPayment.create({data:{reference,gateway,kind,webUserId:user.id,amount,returnTo}});return row;
  });
  const callback=gateway==='PAYSTACK'?`${baseUrl}/${kind==='FILM'?'web':'premium'}-payment-success?returnTo=${returnTo}`:`${baseUrl}/flutterwave/callback`;
  const payload=gateway==='PAYSTACK'?{email:`webuser${user.id}@nigfilm.app`,amount:amount*100,currency:'NGN',reference,callback_url:callback,metadata:{type:kind==='FILM'?'web_film_purchase':'web_premium_subscription',webUserId:user.id}}:{tx_ref:reference,amount,currency:'NGN',redirect_url:callback,customer:{email:`webuser${user.id}@nigfilm.app`,name:user.fullName,phonenumber:user.phone},customizations:{title:'NIGFILM',description:kind==='FILM'?film.title:`${plan} Premium`}};
  let response,data;
  try{response=await fetch(gateway==='PAYSTACK'?'https://api.paystack.co/transaction/initialize':'https://api.flutterwave.com/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});data=await response.json();}catch{fail('An kasa buɗe biyan kuɗi. Sake gwadawa.',502);}
  const authorizationUrl=gateway==='PAYSTACK'?data?.data?.authorization_url:data?.data?.link;
  if(!response.ok||!authorizationUrl||!String(authorizationUrl).startsWith('https://'))fail('An kasa buɗe biyan kuɗi. Sake gwadawa.',502);
  res.json({success:true,authorizationUrl,reference,order:{id:order.id,amount,status:'pending'}});
 });
 app.post('/api/web/payments/initialize',requireWebUser,initialize('FILM'));
 app.post('/api/web/premium/initialize',requireWebUser,initialize('PREMIUM'));
 async function settle(reference,transactionId){
  if(!/^\d+$/.test(String(transactionId)))fail('Invalid transaction.',400);
  const payment=await prisma.checkoutPayment.findUnique({where:{reference}});if(!payment||payment.gateway!=='FLUTTERWAVE')fail('Payment bai samu ba.',404);
  const r=await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,{headers:{Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`},signal:AbortSignal.timeout(20000)});const d=await r.json();
  if(!r.ok||!validPayment(d.data,reference,payment.amount))fail('Ba a tabbatar da biyan kuɗi ba.',409);
  const result=await (payment.kind==='FILM'?processWebPayment:processPremiumPayment)({reference,paidAmount:payment.amount*100});if(!result.success)fail(result.message||'An kasa buɗe access.',503);
  return payment;
 }
 app.get('/flutterwave/callback',async(req,res)=>{
  let payment;try{payment=await settle(String(req.query.tx_ref||''),req.query.transaction_id);res.send(buildWebPaymentPage({success:true,title:'Payment successful',message:'An tabbatar da biyan kuɗi. Koma NIGFILM.',returnUrl:payment.returnTo==='app'?'com.nigfilm.app://payment-success':webUrl}));}
  catch{res.status(409).send(buildWebPaymentPage({success:false,title:'Payment not confirmed',message:'Ba a tabbatar da biyan kuɗi ba tukuna. Idan an cire kuɗi, tuntubi customer care da reference.',returnUrl:webUrl}));}
 });
 app.post('/flutterwave/webhook',wrap(async(req,res)=>{
  if(!validWebhook(req.rawBody,req.headers,process.env.FLUTTERWAVE_WEBHOOK_SECRET))return res.sendStatus(401);
  if(req.body.event!=='charge.completed'||req.body.data?.status!=='successful')return res.sendStatus(200);
  const reference=String(req.body.data.tx_ref||'');if(!await prisma.checkoutPayment.findUnique({where:{reference}}))return res.sendStatus(200);
  await settle(reference,req.body.data.id);res.sendStatus(200);
 }));
}
