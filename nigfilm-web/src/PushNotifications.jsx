import {useEffect,useRef,useState} from "react";
import {Capacitor} from "@capacitor/core";
import {PushNotifications} from "@capacitor/push-notifications";

const tokenKey = "nigfilm_android_push_token";
const sessionKey = "nigfilm_session_token";
const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const channelId = "nigfilm_updates";

async function request(apiUrl,session,path,body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method:body === undefined ? "GET" : "POST", cache:"no-store",
    headers:{Authorization:`Bearer ${session}`, ...(body === undefined ? {} : {"Content-Type":"application/json"})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "An kasa haɗuwa da server.");
  return data;
}

const firstPromptKey = "nigfilm_android_push_permission_asked";
let permissionCheck;
function firstLaunchPermission() {
  if (!permissionCheck) permissionCheck = (async () => {
    const state = await PushNotifications.checkPermissions();
    if (state.receive.startsWith("prompt") && !localStorage.getItem(firstPromptKey)) {
      localStorage.setItem(firstPromptKey,"1");
      return PushNotifications.requestPermissions();
    }
    return state;
  })().finally(() => {permissionCheck = null;});
  return permissionCheck;
}

async function uploadImage(apiUrl,token,file) {
  const response = await fetch(`${apiUrl}/api/admin/push/images`,{
    method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":file.type},body:file,
    signal:AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "An kasa ɗora hoton.");
  return data.imageId;
}

let pushOperation = Promise.resolve();
function serializePush(fn) {
  const result = pushOperation.then(fn);
  pushOperation = result.catch(() => {});
  return result;
}
export function stopAndroidPush(apiUrl,session) {
  if (!isAndroid()) return;
  return serializePush(async () => {
    const token = localStorage.getItem(tokenKey);
    localStorage.removeItem(tokenKey);
    await Promise.allSettled([
      PushNotifications.unregister(),
      PushNotifications.removeAllDeliveredNotifications(),
      session && token ? request(apiUrl,session,"/api/web/push/unregister",{token}) : Promise.resolve(),
    ]);
  });
}

export function useAndroidPush(apiUrl,session) {
  const [state,setState] = useState("idle");
  const [message,setMessage] = useState(null);
  const [ready,setReady] = useState(false);
  const registrationTimer = useRef();
  const supported = isAndroid();
  const currentSession = () => localStorage.getItem(sessionKey) === session;
  useEffect(() => {
    if (supported && !session) void firstLaunchPermission().catch(() => {});
  },[supported,session]);

  useEffect(() => {
    if (!supported || !session) return;
    let active = true;
    const listeners = [];
    const listen = async (event,callback) => {
      const handle = await PushNotifications.addListener(event,callback);
      if (active) listeners.push(handle);
      else await handle.remove();
    };
    const show = notification => {
      if (!active || !currentSession()) return;
      const image = notification.data?.imageUrl;
      const imageUrl = typeof image === "string" && image.startsWith(`${apiUrl.replace(/\/$/,"")}/api/push/images/`) ? image : null;
      setMessage({title:notification.title || "NIGFILM",body:notification.body || "",imageUrl});
    };
    const clear = () => clearTimeout(registrationTimer.current);
    async function setup() {
      setState("idle");
      setReady(false);
      setMessage(null);
      await listen("registration",({value}) => {
        if (!active || !currentSession()) return;
        clear();
        serializePush(async () => {
          if (!active || !currentSession()) return;
          localStorage.setItem(tokenKey,value);
          await request(apiUrl,session,"/api/web/push/register",{token:value,platform:"android"});
          if (active && currentSession()) setState("enabled");
        }).catch(() => { if (active && currentSession()) setState("error"); });
      });
      await listen("registrationError",() => { clear(); if (active && currentSession()) setState("error"); });
      await listen("pushNotificationReceived",show);
      await listen("pushNotificationActionPerformed",event => show(event.notification));
      if (!active || !currentSession()) return;
      setReady(true);
      const permission = await firstLaunchPermission();
      if (!active || !currentSession()) return;
      if (permission.receive === "granted") await register();
      else if (permission.receive === "denied") setState("denied");
    }
    setup().catch(() => { if (active && currentSession()) setState("error"); });
    return () => {active=false;clear();for (const listener of listeners) void listener.remove().catch(() => {});};
  },[apiUrl,session,supported]);

  async function register() {
    return serializePush(async () => {
      if (!session || !currentSession()) return;
      setState("registering");
      await PushNotifications.createChannel({id:channelId,name:"NIGFILM Updates",importance:4});
      if (!currentSession()) return;
      clearTimeout(registrationTimer.current);
      registrationTimer.current = setTimeout(() => {if (currentSession()) setState("error");},15000);
      await PushNotifications.register();
    });
  }
  async function enable() {
    try {
      const permission = await PushNotifications.requestPermissions();
      if (!currentSession()) return;
      if (permission.receive !== "granted") {setState("denied");return;}
      await register();
    } catch {
      if (currentSession()) setState("error");
    }
  }
  return {supported,ready,state,enable,message:session ? message : null,dismiss:()=>setMessage(null)};
}

export function PushPreference({push,language}) {
  if (!push.supported) return null;
  const ha = language === "HAUSA";
  const label = {
    idle:ha ? "Kunna sanarwar NIGFILM" : "Enable NIGFILM notifications",
    enabled:ha ? "Sanarwa tana aiki a wannan waya." : "Notifications are enabled on this device.",
    registering:ha ? "Ana haɗa waya…" : "Registering this device…",
    denied:ha ? "Ba da izinin NIGFILM a saitunan Notifications na wayarka." : "Allow notifications for NIGFILM in Android Settings.",
    error:ha ? "An kasa haɗa waya da sanarwa." : "Could not register for notifications.",
  };
  return <div className="nf-push-preference">
    <p role="status">{label[push.state]}</p>
    {["idle","error","denied"].includes(push.state) && <button type="button" className="secondary-button" onClick={push.enable} disabled={!push.ready}>
      {ha ? "Ba da izinin sanarwa" : "Allow notifications"}
    </button>}
  </div>;
}

export function PushBanner({push,language}) {
  if (!push.message) return null;
  return <aside className="nf-push-banner" role="status">
    <div><strong>{push.message.title}</strong><p>{push.message.body}</p>
      {push.message.imageUrl && <img src={push.message.imageUrl} alt="" />}</div>
    <button type="button" aria-label={language === "HAUSA" ? "Rufe sanarwa" : "Dismiss notification"} onClick={push.dismiss}>×</button>
  </aside>;
}

export function AdminNotifications({apiUrl,token,adminUserId}) {
  const [title,setTitle] = useState("");
  const [body,setBody] = useState("");
  const [audience,setAudience] = useState("self");
  const [userId,setUserId] = useState("");
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState("");
  const fileInput = useRef(null);
  const uploaded = useRef(null);
  useEffect(() => {
    if (!file) {setPreview("");return;}
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  },[file]);
  function chooseImage(event) {
    const picked = event.target.files?.[0];
    if (picked && (!["image/jpeg","image/png"].includes(picked.type) || picked.size > 900*1024)) {
      setError("Zaɓi JPG ko PNG da bai wuce 900 KB ba.");event.target.value = "";setFile(null);return;
    }
    setError("");setFile(picked || null);
  }
  function clearImage() {
    setFile(null);uploaded.current=null;
    if (fileInput.current) fileInput.current.value="";
  }
  const [data,setData] = useState(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const draft = useRef(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {const value = await request(apiUrl,token,"/api/admin/push");if (active) setData(value);}
      catch (e) {if (active) setError(e.message);}
    }
    void load();
    const timer = setInterval(load,8000);
    return () => {active=false;clearInterval(timer);};
  },[apiUrl,token]);
  async function send(event) {
    event.preventDefault();
    if (inFlight.current || !data?.configured) return;
    const targetId = audience === "self" ? Number(adminUserId) : Number(userId);
    if (audience !== "all" && (!Number.isInteger(targetId) || targetId < 1 || targetId > 2147483647)) {
      setError("Saka User ID da ya dace.");return;
    }
    const payload = {
      title:title.trim(),body:body.trim(),audience:audience === "all" ? "all" : "user",
      ...(audience === "all" ? {} : {userId:targetId}),
    };
    if (!payload.title || !payload.body) {setError("Rubuta take da saƙo.");return;}
    if (audience === "all" && !confirm("A tura wannan sanarwar ga duk na’urorin Android da suka yi rajista?")) return;
    inFlight.current = true;
    setBusy(true);setError("");setNotice("");
    try {
      if (file) {
        if (uploaded.current?.file !== file) uploaded.current = {file,id:await uploadImage(apiUrl,token,file)};
        payload.imageId = uploaded.current.id;
      }
      const key = JSON.stringify(payload);
      if (draft.current?.key !== key) draft.current = {key,id:crypto.randomUUID()};
      const queued = await request(apiUrl,token,"/api/admin/push",{...payload,requestId:draft.current.id});
      setNotice(`An sa saƙon a layin aikawa. Na’urori: ${queued.estimatedDevices}.`);
      draft.current=null;setTitle("");setBody("");clearImage();
      const result = await request(apiUrl,token,"/api/admin/push").catch(() => null);
      if (result) setData(result);
    } catch (e) {setError(e.message);}
    finally {inFlight.current=false;setBusy(false);}
  }
  const labels = {QUEUED:"Yana jira",SENDING:"Ana aikawa",FINISHED:"An gama ƙoƙarin aikawa",FAILED:"An kasa ci gaba"};
  return <section className="nf-card">
    <h2>Notifications</h2>
    <p>Tura sanarwa zuwa Android ko da app baya buɗe. Ka fara da gwaji a wayarka.</p>
    {data && !data.configured && <p role="status">Ba a saita Firebase a backend ba tukuna.</p>}
    {error && <p className="nf-error" role="alert">{error}</p>}
    {notice && <p className="nf-notice" role="status">{notice}</p>}
    <form className="nf-push-form" onSubmit={send}>
      <label>Wa za a tura wa?
        <select value={audience} disabled={busy} onChange={e=>setAudience(e.target.value)}>
          <option value="self">Asusuna — gwaji</option>
          <option value="user">User ɗaya</option>
          <option value="all">Duk Android da suka yi rajista</option>
        </select>
      </label>
      {audience === "user" && <label>User ID<input inputMode="numeric" pattern="[0-9]+" required value={userId} disabled={busy} onChange={e=>setUserId(e.target.value)} /></label>}
      <label>Take<input required maxLength={80} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} /></label>
      <label>Saƙo<textarea required maxLength={300} rows={3} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} /></label>
      <label>Hoto (idan ana so)
        <input ref={fileInput} type="file" accept="image/jpeg,image/png" disabled={busy} onChange={chooseImage} />
        <small>JPG ko PNG · iyaka 900 KB. Ka zaɓi hoton da kake son recipients su gani.</small>
      </label>
      {preview && <div className="nf-push-image-preview"><img src={preview} alt="Hoton sanarwar" />
        <button type="button" className="nf-link" disabled={busy} onClick={clearImage}>Cire hoto</button></div>}
      <button type="submit" disabled={busy || !data?.configured}>{busy ? "Ana shirya saƙo…" : "Tura notification"}</button>
    </form>
    {!!data?.campaigns?.length && <div className="nf-push-history">
      <h3>Tarihin sanarwa</h3>
      <p>“Firebase ya karɓa” na nufin ya karɓi buƙatar aikawa, ba tabbacin an ga saƙon a waya ba.</p>
      {data.campaigns.map(item=><article key={item.id} className="nf-admin-row">
        <div><strong>{item.title}</strong><small>{item.targetUserId ? `User #${item.targetUserId}` : "Duk Android"} · {new Date(item.createdAt).toLocaleString()}</small>
        <small>{labels[item.status] || item.status} · Firebase ya karɓa: {item.accepted} · Ba su yi nasara ba: {item.failed}</small>
        {item.errorCode && <small>{item.errorCode}</small>}</div>
      </article>)}
    </div>}
  </section>;
}
