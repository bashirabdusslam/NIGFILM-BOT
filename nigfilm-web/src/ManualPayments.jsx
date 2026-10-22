import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './ManualPayments.css';

const newKey=()=>globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=globalThis.crypto.getRandomValues(new Uint8Array(1))[0]&15;return(c==='x'?n:(n&3)|8).toString(16)});
const money=n=>`₦${Number(n||0).toLocaleString()}`;
const statusLabel={PENDING_PAYMENT:'Ana jiran transfer',SUBMITTED:'Ana jiran admin',APPROVED:'An buɗe access',REJECTED:'An ƙi buƙatar'};
async function call(apiUrl,token,path,body,method='POST'){
  const response=await fetch(`${apiUrl}${path}`,{method:body===undefined?'GET':method,
    headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok || !data?.success)throw Error(data?.message||`An kasa haɗuwa da server (${response.status}).`);
  return data;
}
function Notice({error,message}){return <>{error&&<p role="alert" className="manual-error">{error}</p>}{message&&<p role="status" className="manual-success">{message}</p>}</>}
function Modal({title,onClose,children}){
  const closeRef=useRef(null);
  useEffect(()=>{const previous=document.activeElement;closeRef.current?.focus();const key=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus?.()}},[]);
  return createPortal(<div className="manual-overlay"><section className="manual-ui manual-dialog" role="dialog" aria-modal="true" aria-label={title}><div className="manual-heading"><h2>{title}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Close">✕</button></div>{children}</section></div>,document.body);
}
function RequestCard({request,apiUrl,token,onUpdate,onAccess}){
  const [payerName,setPayerName]=useState(request.payerName||'');
  const [transferReference,setTransferReference]=useState(request.transferReference||'');
  const [userNote,setUserNote]=useState(request.userNote||'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const inFlight=useRef(false),callbacks=useRef({onUpdate,onAccess});callbacks.current={onUpdate,onAccess};
  useEffect(()=>{
    if(!['SUBMITTED','PENDING_PAYMENT'].includes(request.status))return;
    let cancelled=false,timer;
    async function refresh(){
      try{const d=await call(apiUrl,token,'/api/manual-payment/requests');const next=d.requests.find(r=>r.id===request.id);
        if(!cancelled&&next){callbacks.current.onUpdate?.(next);if(next.status==='APPROVED')callbacks.current.onAccess?.();
          if(!['SUBMITTED','PENDING_PAYMENT'].includes(next.status))return;}}
      catch{/* Keep the last confirmed state; a failed poll never grants access. */}
      if(!cancelled)timer=setTimeout(refresh,10000);
    }
    timer=setTimeout(refresh,10000);return()=>{cancelled=true;clearTimeout(timer)};
  },[apiUrl,token,request.id,request.status]);
  async function submit(e){e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    try{const d=await call(apiUrl,token,`/api/manual-payment/requests/${request.id}/submit`,{payerName,transferReference,userNote});onUpdate?.(d.request)}
    catch(e){setError(e.message)}finally{setBusy(false);inFlight.current=false}}
  return <article className="manual-card"><h3>{request.title}</h3><p><b>{money(request.amount)}</b> · {statusLabel[request.status]||request.status}</p><p className="manual-small">Reference: {request.reference}</p>
    {request.source==='ADMIN'?<p>Admin ne ya ba ka wannan access kai tsaye.</p>:<>
      {request.status==='PENDING_PAYMENT'&&<><div className="manual-bank"><span>{request.bankName}</span><strong>{request.accountNumber}</strong><span>{request.accountName}</span></div>
        {request.instructions&&<p>{request.instructions}</p>}<p>Ka tura daidai {money(request.amount)}, sannan ka cika bayanin transfer. Ka biya wannan order sau ɗaya kawai.</p>
        <form onSubmit={submit}><label>Sunan mai tura kuɗi<input required minLength={2} maxLength={150} value={payerName} onChange={e=>setPayerName(e.target.value)}/></label>
        <label>Transfer reference / transaction ID<input required minLength={3} maxLength={150} value={transferReference} onChange={e=>setTransferReference(e.target.value)}/></label>
        <label>Ƙarin bayani (optional)<textarea maxLength={1000} value={userNote} onChange={e=>setUserNote(e.target.value)}/></label>
        <button disabled={busy} type="submit">{busy?'Ana turawa…':'Na biya — tura wa admin'}</button></form></>}
      {request.status==='SUBMITTED'&&<p>Admin zai duba kuɗin da ka tura. Kada ka sake transfer saboda kana jiran amincewa.</p>}
      {request.status==='APPROVED'&&<p>Access ya buɗe. Duba My Movies ko Premium.</p>}
      {request.reviewNote&&<p>Bayanin admin: {request.reviewNote}</p>}
    </>}<Notice error={error}/></article>
}
export function ManualPaymentButton({apiUrl,token,kind,filmId,plan,onAccess}){
  const [open,setOpen]=useState(false),[request,setRequest]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const requestKey=useRef(null),lock=useRef(false);
  useEffect(()=>{requestKey.current=null;setRequest(null);setOpen(false)},[kind,filmId,plan,token]);
  async function begin(){if(lock.current)return;setOpen(true);if(request)return;lock.current=true;setBusy(true);setError('');requestKey.current||=newKey();
    try{if(!token)throw Error('Ka shiga account domin biyan transfer.');const settings=await call(apiUrl,token,'/api/manual-payment/settings');if(!settings.settings.enabled)throw Error('Admin bai kunna biyan transfer ba tukuna.');const d=await call(apiUrl,token,'/api/manual-payment/requests',{kind,filmId,plan,requestKey:requestKey.current});setRequest(d.request)}catch(e){setError(e.message)}finally{lock.current=false;setBusy(false)}}
  return <><button type="button" className="secondary-button" style={{width:"100%",minHeight:48,border:"2px solid #d4af37",marginTop:10}} onClick={begin}>{kind==='PREMIUM'?'Biya Premium ta bank transfer':'Saya film ta bank transfer'}</button>
    {open&&<Modal title="Biyan transfer" onClose={()=>setOpen(false)}>{busy&&<p>Ana shirya buƙata…</p>}<Notice error={error}/>{!request&&!busy&&<button type="button" onClick={begin}>Sake gwadawa</button>}
      {request&&<RequestCard request={request} apiUrl={apiUrl} token={token} onUpdate={setRequest} onAccess={onAccess}/>}</Modal>}</>;
}
export function ManualPaymentHistory({apiUrl,token,onBack,onAccess}){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(){setBusy(true);setError('');try{const d=await call(apiUrl,token,'/api/manual-payment/requests');setRows(d.requests)}catch(e){setError(e.message)}finally{setBusy(false)}}
  useEffect(()=>{load()},[apiUrl,token]);
  return <main className="manual-ui manual-page"><button onClick={onBack}>← Komawa profile</button><h2>Buƙatun transfer da access</h2><button disabled={busy} onClick={load}>{busy?'Ana dubawa…':'Sake dubawa'}</button><Notice error={error}/>
    {!busy&&!rows.length&&<p>Babu buƙatar da aka samu.</p>}{rows.map(r=><RequestCard key={r.id} request={r} apiUrl={apiUrl} token={token} onAccess={onAccess} onUpdate={next=>setRows(rows=>rows.map(item=>item.id===next.id?next:item))}/>)}</main>;
}
export function ManualPaymentAdmin({apiUrl,token,films,onBack}){
  const empty={enabled:false,bankName:'',accountName:'',accountNumber:'',instructions:''};
  const [settings,setSettings]=useState(empty),[rows,setRows]=useState([]),[status,setStatus]=useState('SUBMITTED'),[page,setPage]=useState(1),[total,setTotal]=useState(0);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [query,setQuery]=useState(''),[users,setUsers]=useState([]),[target,setTarget]=useState(null);
  const [kind,setKind]=useState('FILM'),[filmId,setFilmId]=useState(''),[plan,setPlan]=useState('MONTHLY'),[note,setNote]=useState(''),[reviewNotes,setReviewNotes]=useState({});
  const [verifiedRefs,setVerifiedRefs]=useState({});
  const [filmQuery,setFilmQuery]=useState('');
  const actionLock=useRef(false),grantKey=useRef(null);
  useEffect(()=>{grantKey.current=null},[target?.id,kind,filmId,plan]);
  async function requests(p=page,s=status){const d=await call(apiUrl,token,`/api/admin/manual-payment/requests?page=${p}&status=${encodeURIComponent(s)}`);setRows(d.requests);setTotal(d.total)}
  useEffect(()=>{let stop=false;call(apiUrl,token,'/api/admin/manual-payment/settings').then(d=>{if(!stop)setSettings(d.settings||empty)}).catch(e=>{if(!stop)setError(e.message)});return()=>{stop=true}},[apiUrl,token]);
  useEffect(()=>{requests(page,status).catch(e=>setError(e.message))},[apiUrl,token,page,status]);
  async function action(fn){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError('');setMessage('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false);actionLock.current=false}}
  async function save(e){e.preventDefault();action(async()=>{await call(apiUrl,token,'/api/admin/manual-payment/settings',settings,'PUT');setMessage('An adana account settings.')})}
  async function review(r,decision){
    if(decision==='approve'&&!window.confirm(`Ka tabbatar kuɗin ${money(r.amount)} sun shiga BANK STATEMENT?\n${r.user?.fullName} (${r.user?.phone})\n${r.title}\n${r.reference}\nReceipt ko “Na biya” kaɗai ba tabbacin kuɗi ba ne.`))return;
    action(async()=>{await call(apiUrl,token,`/api/admin/manual-payment/requests/${r.id}/${decision}`,{note:reviewNotes[r.id]||'',confirmed:decision==='approve',verifiedTransferReference:verifiedRefs[r.id]||''});await requests();setMessage(decision==='approve'?'An buɗe access.':'An ƙi buƙatar.')})
  }
  async function search(e){e.preventDefault();action(async()=>{const d=await call(apiUrl,token,`/api/admin/manual-payment/users?q=${encodeURIComponent(query)}`);setUsers(d.users);setTarget(null)})}
  async function grant(e){e.preventDefault();if(!target)return;const selected=kind==='FILM'?films.find(f=>Number(f.id)===Number(filmId)):null;
    if(!window.confirm(`Buɗe ${kind==='FILM'?selected?.title:plan+' Premium'} ga ${target.fullName}, ${target.phone} (ID ${target.id})?\nWannan grant ne kai tsaye; ba zai nuna kuɗin shiga ba.`))return;
    grantKey.current||=newKey();action(async()=>{await call(apiUrl,token,'/api/admin/manual-payment/grants',{webUserId:target.id,kind,filmId:Number(filmId),plan,note,confirmed:true,requestKey:grantKey.current});setMessage('An ba user access kai tsaye. An adana tarihin grant.');await requests()})}
  const filtered=films.filter(f=>String(f.title).toLowerCase().includes(filmQuery.toLowerCase()));
  return <main className="manual-ui manual-page"><button onClick={onBack}>← Komawa profile</button><h1>Admin · Transfer da access</h1><Notice error={error} message={message}/>
    <section className="manual-card"><h2>Account na karɓar transfer</h2><form onSubmit={save}><label className="manual-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Kunna biyan transfer</label>
      {[['bankName','Sunan banki'],['accountName','Sunan account'],['accountNumber','Account number']].map(([key,label])=><label key={key}>{label}<input required value={settings[key]} maxLength={key==='accountNumber'?10:key==='bankName'?100:150} inputMode={key==='accountNumber'?'numeric':undefined} pattern={key==='accountNumber'?'[0-9]{10}':undefined} onChange={e=>setSettings({...settings,[key]:e.target.value})}/></label>)}
      <label>Umarnin biyan kuɗi<textarea maxLength={1000} value={settings.instructions} onChange={e=>setSettings({...settings,instructions:e.target.value})}/></label><button disabled={busy}>Adana account</button></form>
      <p className="manual-small">Canjin account zai shafi sabbin buƙatu. Tsofaffin buƙatu za su riƙe account ɗin da aka nuna musu.</p></section>
    <section className="manual-card"><h2>Buƙatun biyan kuɗi</h2><label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>{[['SUBMITTED','Masu jiran amincewa'],['PENDING_PAYMENT','Masu jiran transfer'],['APPROVED','An amince / grants'],['REJECTED','An ƙi']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <button disabled={busy} onClick={()=>action(()=>requests())}>Sake dubawa</button>
      {!rows.length&&<p>Babu buƙatu a wannan jerin.</p>}{rows.map(r=><article className="manual-card" key={r.id}><h3>{r.user?.fullName||`User ${r.webUserId}`} · {r.user?.phone}</h3><p>{r.title} · {money(r.amount)} · {statusLabel[r.status]}</p><p className="manual-small">{r.reference}<br/>{new Date(r.createdAt).toLocaleString()}</p>
        <p>Account da aka nuna: {r.bankName} {r.accountNumber}<br/>{r.accountName}</p><p>Mai tura kuɗi (bayanin user): {r.payerName||'—'}<br/>Transfer reference (bayanin user): {r.transferReference||'—'}</p>{r.userNote&&<p>{r.userNote}</p>}
        {r.status==='SUBMITTED'?<><label>Bank transaction reference da ka tabbatar<input maxLength={150} value={verifiedRefs[r.id]||''} onChange={e=>setVerifiedRefs({...verifiedRefs,[r.id]:e.target.value})}/></label><label>Bayanin admin / dalilin ƙin amincewa<textarea maxLength={1000} value={reviewNotes[r.id]||''} onChange={e=>setReviewNotes({...reviewNotes,[r.id]:e.target.value})}/></label><div className="manual-actions"><button disabled={busy} onClick={()=>review(r,'approve')}>Na tabbatar kuɗi — buɗe access</button><button disabled={busy} onClick={()=>review(r,'reject')}>Ƙi buƙatar</button></div></>:<p>{r.reviewNote} {r.verifiedTransferReference&&`· Bank ref: ${r.verifiedTransferReference}`} {r.reviewedBy?`· Admin ID ${r.reviewedBy}`:''}</p>}</article>)}
      <div className="manual-actions"><button disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)}>← Baya</button><span>Shafi {page} · {total} records</span><button disabled={busy||page*30>=total} onClick={()=>setPage(p=>p+1)}>Gaba →</button></div></section>
    <section className="manual-card"><h2>Ba user access kai tsaye</h2><form onSubmit={search}><label>Nemo user da suna, waya ko ID<input required minLength={1} value={query} onChange={e=>setQuery(e.target.value)}/></label><button disabled={busy}>Nemo user</button></form>
      {users.map(u=><button key={u.id} className={target?.id===u.id?'manual-selected':''} disabled={busy} onClick={()=>setTarget(u)}>{u.fullName} · {u.phone} · ID {u.id}</button>)}
      {target&&<form onSubmit={grant}><p><b>Zaɓaɓɓen user:</b> {target.fullName} · {target.phone}</p><label>Nau'in access<select value={kind} onChange={e=>setKind(e.target.value)}><option value="FILM">Film ɗaya</option><option value="PREMIUM">Premium</option></select></label>
        {kind==='FILM'?<><label>Nemo film<input value={filmQuery} onChange={e=>{setFilmQuery(e.target.value);setFilmId('')}}/></label><label>Zaɓi film<select required value={filmId} onChange={e=>setFilmId(e.target.value)}><option value="">Zaɓi film</option>{filtered.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label></>:<label>Premium plan<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>}
        <label>Dalilin grant<input required minLength={5} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy}>Buɗe access ga wannan user</button><p className="manual-small">Grant kai tsaye yana ₦0 a tarihin order. Don payment na user, yi amfani da amincewa a jerin buƙatu.</p></form>}</section></main>;
}
