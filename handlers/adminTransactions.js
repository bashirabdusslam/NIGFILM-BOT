// Read-only report. SQL identifiers are fixed; every request value is bound.
export const transactionSql = `
WITH entries AS (
 SELECT 'web-'||o.id AS id, o."createdAt" AS date, u."fullName" AS customer,
 u.phone AS contact, f.title AS item, o.amount, o.status AS raw_status,
 o."paymentReference" AS reference, CASE WHEN b.id IS NULL THEN 'PAYSTACK' ELSE 'BILLSTACK' END AS method,
 'WEB_FILM' AS kind
 FROM "WebOrder" o JOIN "WebUser" u ON u.id=o."webUserId" JOIN "Film" f ON f.id=o."filmId"
 LEFT JOIN "BillstackPayment" b ON b."orderReference"=o."paymentReference"
 WHERE NOT EXISTS (SELECT 1 FROM "ManualAccessRequest" m WHERE m.reference=o."paymentReference")
 UNION ALL
 SELECT 'premium-'||o.id,o."createdAt",u."fullName",u.phone,'Premium: '||o.plan::text,o.amount,o.status,o."paymentReference",
 CASE WHEN b.id IS NULL THEN 'PAYSTACK' ELSE 'BILLSTACK' END,'PREMIUM'
 FROM "PremiumOrder" o JOIN "WebUser" u ON u.id=o."webUserId"
 LEFT JOIN "BillstackPayment" b ON b."orderReference"=o."paymentReference"
 WHERE NOT EXISTS (SELECT 1 FROM "ManualAccessRequest" m WHERE m.reference=o."paymentReference")
 UNION ALL
 SELECT 'telegram-'||o.id,o."createdAt",COALESCE(NULLIF(concat_ws(' ',u."firstName",u."lastName"),''),u.username,o."telegramId"),
 o."telegramId",CASE WHEN o."cartFilmIds" IS NOT NULL THEN 'Telegram cart: '||o."cartFilmIds" ELSE f.title END,
 o.amount,o.status,o."paymentReference",CASE WHEN o."virtualAccountReference" IS NOT NULL THEN 'BANK_TRANSFER' ELSE 'PAYSTACK' END,'TELEGRAM'
 FROM "Order" o JOIN "User" u ON u."telegramId"=o."telegramId" JOIN "Film" f ON f.id=o."filmId"
 UNION ALL
 SELECT 'manual-'||m.id,m."createdAt",COALESCE(u."fullName",'User #'||m."webUserId"),COALESCE(u.phone,''),
 m.title,m.amount,m.status,m.reference,CASE WHEN m.source='ADMIN' THEN 'ADMIN_GRANT' ELSE 'MANUAL_TRANSFER' END,m.kind
 FROM "ManualAccessRequest" m LEFT JOIN "WebUser" u ON u.id=m."webUserId"
), normalized AS (
 SELECT *, CASE WHEN method='ADMIN_GRANT' THEN 'GRANTED'
 WHEN lower(raw_status) IN ('paid','success','successful','approved') THEN 'PAID'
 WHEN lower(raw_status) IN ('failed','rejected','cancelled','canceled','expired') THEN 'FAILED'
 WHEN lower(raw_status) IN ('pending','pending_payment','submitted','processing','creating') THEN 'PENDING'
 ELSE 'OTHER' END AS status FROM entries
), filtered AS (
 SELECT * FROM normalized WHERE
 ($1='' OR strpos(lower(customer||' '||contact||' '||reference||' '||item),lower($1))>0)
 AND ($2='' OR method=$2) AND ($3='' OR status=$3)
 AND ($4::timestamptz IS NULL OR date >= $4::timestamptz)
 AND ($5::timestamptz IS NULL OR date < $5::timestamptz)
), paged AS (SELECT * FROM filtered ORDER BY date DESC,id DESC LIMIT $6 OFFSET $7)
SELECT (SELECT count(*)::int FROM filtered) AS total,
 (SELECT COALESCE(sum(amount) FILTER (WHERE status='PAID'),0)::text FROM filtered) AS "paidAmount",
 (SELECT count(*)::int FROM filtered WHERE status='PAID') AS "paidCount",
 (SELECT count(*)::int FROM filtered WHERE status='PENDING') AS "pendingCount",
 COALESCE((SELECT json_agg(paged ORDER BY date DESC,id DESC) FROM paged),'[]'::json) AS rows`;

export function parseTransactionFilters(q) {
 const search=String(q.search||'').trim().slice(0,150), method=String(q.method||''),status=String(q.status||'');
 if(!['','PAYSTACK','BILLSTACK','BANK_TRANSFER','MANUAL_TRANSFER','ADMIN_GRANT'].includes(method)||!['','PAID','PENDING','FAILED','GRANTED','OTHER'].includes(status))throw Error('Invalid filter.');
 function date(value,end=false){
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw Error('Invalid date.');
  const d=new Date(`${value}T00:00:00+01:00`);
  if(!Number.isFinite(d.getTime())||new Date(d.getTime()+3600000).toISOString().slice(0,10)!==value)throw Error('Invalid date.');
  if(end)d.setUTCDate(d.getUTCDate()+1);return d;
 }
 const from=date(q.from),to=date(q.to,true);
 if(from&&to&&from>=to)throw Error('Invalid date range.');
 const page=Number(q.page||1);if(!Number.isSafeInteger(page)||page<1||page>1000000)throw Error('Invalid page.');
 return {page,params:[search,method,status,from,to,25,(page-1)*25]};
}
export function registerAdminTransactions({app,prisma,requireAdmin}) {
 app.get('/api/admin/transactions',requireAdmin,async(req,res)=>{
  let filters;try{filters=parseTransactionFilters(req.query);}catch(e){return res.status(400).json({success:false,message:e.message});}
  try{
   const [report]=await prisma.$queryRawUnsafe(transactionSql,...filters.params);
   res.set('Cache-Control','no-store');
   return res.json({success:true,...report,page:filters.page,pageSize:25});
  }catch(e){console.error('Admin transactions report failed:',e.code||e.name);return res.status(500).json({success:false,message:'An kasa loda transactions. Sake gwadawa.'});}
 });
}
