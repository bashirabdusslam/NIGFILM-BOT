import {createPrivateKey, randomUUID, sign} from "node:crypto";

const OAUTH_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const BATCH = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function imageMime(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > 900 * 1024) return null;
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      bytes.subarray(12,16).toString() === "IHDR") return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
      bytes.at(-2) === 255 && bytes.at(-1) === 217) return "image/jpeg";
  return null;
}
const TIMEOUT = 8000;
const LEASE_MS = 120_000;
const b64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const config = () => {
  const account = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON || "{}");
  const projectId = process.env.FCM_PROJECT_ID || account.project_id;
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(projectId || "") ||
      typeof account.client_email !== "string" || !account.client_email.includes("@")) {
    throw new Error("FCM_CONFIG");
  }
  return {projectId, email: account.client_email, key: createPrivateKey(account.private_key)};
};
function pushError(code) {
  return Object.assign(new Error(code), {code});
}
export function createFcmClient({loadConfig = config, fetcher = globalThis.fetch, now = Date.now} = {}) {
  let cache;
  let authenticating;
  async function credentials() {
    if (cache?.expires > now() + 60_000) return cache;
    if (!authenticating) authenticating = (async () => {
      const c = loadConfig();
      const iat = Math.floor(now() / 1000);
      const unsigned = b64({alg:"RS256",typ:"JWT"}) + "." +
        b64({iss:c.email,scope:SCOPE,aud:OAUTH_URL,iat,exp:iat+3600});
      const assertion = unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), c.key).toString("base64url");
      const response = await fetcher(OAUTH_URL, {
        method:"POST", signal:AbortSignal.timeout(TIMEOUT),
        body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.access_token !== "string") throw pushError("FCM_AUTH");
      cache = {projectId:c.projectId, token:result.access_token, expires:now()+Number(result.expires_in || 3600)*1000};
      return cache;
    })().finally(() => { authenticating = null; });
    return authenticating;
  }
  async function send(deviceToken, job, c) {
    try {
      const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${c.projectId}/messages:send`, {
        method:"POST", signal:AbortSignal.timeout(TIMEOUT),
        headers:{Authorization:`Bearer ${c.token}`,"Content-Type":"application/json"},
        body:JSON.stringify({message:{
          token:deviceToken, notification:{title:job.title,body:job.body},
          ...(job.imageUrl ? {data:{imageUrl:job.imageUrl}} : {}),
          android:{priority:"HIGH",ttl:"3600s",notification:{tag:`nigfilm-${job.id}`,channel_id:"nigfilm_updates",sound:"default",...(job.imageUrl ? {image:job.imageUrl} : {})}},
        }}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.name === "string") return {accepted:true};
      const code = data.error?.details?.find?.(d => d["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError")?.errorCode;
      if (response.status === 401) cache = null;
      return {accepted:false, unregistered:code === "UNREGISTERED",
        code: code === "SENDER_ID_MISMATCH" ? code : `FCM_HTTP_${response.status}`};
    } catch {
      return {accepted:false, code:"FCM_NETWORK"};
    }
  }
  return {credentials, send};
}
export function parsePushCampaign(input) {
  const clean = value => typeof value === "string" ? value.trim() : "";
  const title = clean(input?.title), body = clean(input?.body);
  const requestId = clean(input?.requestId);
  const imageId = clean(input?.imageId) || null;
  if (!UUID.test(requestId) || (imageId && !UUID.test(imageId)) ||
      !title || title.length > 80 || !body || body.length > 300) return null;
  if (input.audience === "all") return {id:requestId,title,body,imageId,targetUserId:null};
  if (input.audience !== "user" || !Number.isInteger(input.userId) || input.userId < 1 || input.userId > 2147483647) return null;
  return {id:requestId,title,body,imageId,targetUserId:input.userId};
}
const audienceFilter = targetUserId => ({
  enabled:true, platform:"android", ...(targetUserId === null ? {} : {webUserId:targetUserId}),
});
const view = {
  id:true,title:true,body:true,targetUserId:true,createdAt:true,status:true,estimatedDevices:true,
  accepted:true,failed:true,finishedAt:true,errorCode:true,
};
export async function processPushBatch(prisma, fcm, now = new Date()) {
  const ready = {status:{in:["QUEUED","SENDING"]},OR:[{leaseUntil:null},{leaseUntil:{lte:now}}]};
  const job = await prisma.pushCampaign.findFirst({where:ready,orderBy:[{createdAt:"asc"},{id:"asc"}]});
  if (!job) return false;
  const leaseId = randomUUID();
  const claimed = await prisma.pushCampaign.updateMany({
    where:{id:job.id,...ready},
    data:{status:"SENDING",leaseId,leaseUntil:new Date(now.getTime()+LEASE_MS)},
  });
  if (!claimed.count) return false;
  const update = data => prisma.pushCampaign.updateMany({
    where:{id:job.id,leaseId},data:{...data,leaseId:null,leaseUntil:null},
  });
  if (now.getTime() - job.createdAt.getTime() > 86400_000) {
    await update({status:"FAILED",errorCode:"CAMPAIGN_EXPIRED",finishedAt:now});
    return true;
  }
  const devices = await prisma.pushDevice.findMany({
    where:{...audienceFilter(job.targetUserId),id:{gt:job.cursor,lte:job.lastDeviceId},createdAt:{lte:job.createdAt}},
    orderBy:{id:"asc"},take:BATCH,select:{id:true,token:true,webUserId:true,updatedAt:true},
  });
  if (!devices.length) {
    await update({status:"FINISHED",finishedAt:now});
    return true;
  }
  let c;
  try { c = await fcm.credentials(); }
  catch {
    await update({status:"FAILED",errorCode:"FCM_AUTH",finishedAt:now});
    return true;
  }
  let accepted = 0, failed = 0, errorCode = job.errorCode;
  for (let i=0;i<devices.length;i+=8) {
    await Promise.all(devices.slice(i,i+8).map(async device => {
      const result = await fcm.send(device.token,job,c);
      if (result.accepted) accepted++;
      else {
        failed++;
        errorCode = result.unregistered ? "UNREGISTERED" : result.code;
        if (result.unregistered) await prisma.pushDevice.updateMany({
          where:{id:device.id,webUserId:device.webUserId,updatedAt:device.updatedAt}, data:{enabled:false},
        }).catch(() => {});
      }
    }));
  }
  const finished = devices.length < BATCH;
  await update({
    cursor:devices.at(-1).id,accepted:{increment:accepted},failed:{increment:failed},errorCode,
    ...(finished ? {status:"FINISHED",finishedAt:new Date()} : {}),
  });
  return true;
}
export function registerPushNotifications({app,prisma,requireAdmin,requireWebUser,parseImage,baseUrl}) {
  const configured = () => { try { config(); return true; } catch { return false; } };
  const route = handler => async (req,res) => {
    try { await handler(req,res); }
    catch (e) {
      console.error("Push operation failed:", e?.code || e?.name || "error");
      res.status(500).json({success:false,message:"An samu matsala wajen notification."});
    }
  };
  app.post("/api/admin/push/images",requireAdmin,(req,res,next) => {
    parseImage(req,res,error => {
      if (error) return res.status(error.status === 413 ? 413 : 400).json({success:false,message:"Hoton ya yi girma ko bai dace ba."});
      next();
    });
  },route(async (req,res) => {
    const mime = imageMime(req.body);
    if (!mime) return res.status(400).json({success:false,message:"Zaɓi hoton JPG ko PNG da bai wuce 900 KB ba."});
    if (!baseUrl?.startsWith("https://")) return res.status(503).json({success:false,message:"PUBLIC_BASE_URL yana buƙatar HTTPS domin aika hoto."});
    const id = randomUUID();
    await prisma.pushImage.create({data:{
      id,adminId:req.webUser.id,mime,bytes:req.body,expiresAt:new Date(Date.now()+48*3600_000),
    }});
    res.status(201).json({success:true,imageId:id});
  }));
  app.get("/api/push/images/:id",route(async (req,res) => {
    if (!UUID.test(req.params.id)) return res.sendStatus(404);
    const image = await prisma.pushImage.findFirst({
      where:{id:req.params.id,expiresAt:{gt:new Date()}},select:{mime:true,bytes:true},
    });
    if (!image) return res.sendStatus(404);
    res.set({"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"});
    res.type(image.mime).send(Buffer.from(image.bytes));
  }));
  app.post("/api/web/push/unregister",requireWebUser,route(async (req,res) => {
    const token = req.body?.token;
    if (typeof token !== "string" || token.length < 20 || token.length > 4096) {
      return res.status(400).json({success:false,message:"Token bai dace ba."});
    }
    await prisma.pushDevice.updateMany({where:{token,webUserId:req.webUser.id},data:{enabled:false}});
    res.json({success:true});
  }));
  app.get("/api/admin/push",requireAdmin,route(async (_req,res) => {
    res.set("Cache-Control","no-store");
    const campaigns = await prisma.pushCampaign.findMany({orderBy:{createdAt:"desc"},take:12,select:view});
    res.json({success:true,configured:configured(),campaigns});
  }));
  app.post("/api/admin/push",requireAdmin,route(async (req,res) => {
    const data = parsePushCampaign(req.body);
    if (!data) return res.status(400).json({success:false,message:"Duba take, saƙo, da wanda za a tura wa."});
    const existing = await prisma.pushCampaign.findUnique({where:{id:data.id}});
    const adminId = req.webUser.id;
    if (existing) {
      if (existing.adminId !== adminId || existing.title !== data.title ||
          existing.body !== data.body || existing.targetUserId !== data.targetUserId || existing.imageId !== data.imageId) {
        return res.status(409).json({success:false,message:"Wannan request ya riga ya wanzu."});
      }
      return res.json({success:true,id:existing.id,estimatedDevices:existing.estimatedDevices});
    }
    if (!configured()) return res.status(503).json({success:false,message:"Ba a saita Firebase a backend ba."});
    let imageUrl = null;
    if (data.imageId) {
      const image = await prisma.pushImage.findFirst({
        where:{id:data.imageId,adminId,expiresAt:{gt:new Date(Date.now()+25*3600_000)}},select:{id:true},
      });
      if (!image || !baseUrl?.startsWith("https://")) return res.status(400).json({success:false,message:"Sake zaɓar hoton."});
      imageUrl = `${baseUrl.replace(/\/$/,"")}/api/push/images/${image.id}`;
    }
    const where = audienceFilter(data.targetUserId);
    const newest = await prisma.pushDevice.findFirst({where,orderBy:{id:"desc"},select:{id:true}});
    if (!newest) return res.status(400).json({success:false,message:"Babu Android da ya yi rajistar notification ga wannan zaɓi."});
    const estimatedDevices = await prisma.pushDevice.count({where:{...where,id:{lte:newest.id}}});
    try {
      await prisma.pushCampaign.create({data:{...data,adminId,imageUrl,estimatedDevices,lastDeviceId:newest.id}});
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const duplicate = await prisma.pushCampaign.findUnique({where:{id:data.id}});
      if (!duplicate || duplicate.adminId !== adminId || duplicate.title !== data.title ||
          duplicate.body !== data.body || duplicate.targetUserId !== data.targetUserId || duplicate.imageId !== data.imageId) {
        return res.status(409).json({success:false,message:"Wannan request ya riga ya wanzu."});
      }
      return res.json({success:true,id:duplicate.id,estimatedDevices:duplicate.estimatedDevices});
    }
    res.status(202).json({success:true,id:data.id,estimatedDevices});
  }));
  const fcm = createFcmClient();
  let running = false, lastCleanup = 0;
  const timer = setInterval(async () => {
    if (running || !process.env.FCM_SERVICE_ACCOUNT_JSON) return;
    running = true;
    try {
      await processPushBatch(prisma,fcm);
      if (Date.now() - lastCleanup > 3600_000) {
        lastCleanup = Date.now();
        await prisma.pushImage.deleteMany({where:{expiresAt:{lte:new Date()}}});
      }
    }
    catch (e) { console.error("Push queue failed:",e?.code || e?.name || "error"); }
    finally { running = false; }
  }, 4000);
  timer.unref?.();
  return () => clearInterval(timer);
}
