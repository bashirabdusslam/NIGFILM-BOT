import { useEffect, useState } from 'react';
import './AdminTransactions.css';
const money=n=>`NGN ${Number(n||0).toLocaleString('en-NG')}`;
export default function AdminTransactions({apiUrl,token,onBack}){
 const [form,setForm]=useState({search:'',method:'',status:'',from:'',to:''});
 const [query,setQuery]=useState({...form,page:1}),[report,setReport]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setReport(null);
 (async()=>{try{const r=await fetch(`${apiUrl}/api/admin/transactions?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});const d=await r.json().catch(()=>null);if(!r.ok||!d?.success)throw Error(d?.message||`An kasa loda bayanai (${r.status}).`);if(!controller.signal.aborted)setReport(d);}catch(e){if(!controller.signal.aborted)setError(e.message);}finally{if(!controller.signal.aborted)setBusy(false);}})();return()=>controller.abort();},[apiUrl,token,query,reload]);
 const field=(name,value)=>setForm(v=>({...v,[name]:value}));
 return <main className="transactions-page"><button onClick={onBack}>Komawa profile</button><h1>Dukkan Transactions</h1>
 <p>Orders da aka adana: film, Premium, Telegram da manual transfer. Access na kyauta baya cikin kudin shiga.</p>
 <form onSubmit={e=>{e.preventDefault();setQuery({...form,page:1});setReload(n=>n+1);}} className="transactions-filters">
 <label>Bincike<input value={form.search} placeholder="Suna, waya, film ko reference" onChange={e=>field('search',e.target.value)}/></label>
 <label>Hanyar biya<select value={form.method} onChange={e=>field('method',e.target.value)}>{['','PAYSTACK','BILLSTACK','BANK_TRANSFER','MANUAL_TRANSFER','ADMIN_GRANT'].map(v=><option key={v} value={v}>{v||'Duka'}</option>)}</select></label>
 <label>Status<select value={form.status} onChange={e=>field('status',e.target.value)}>{['','PAID','PENDING','FAILED','GRANTED','OTHER'].map(v=><option key={v} value={v}>{v||'Duka'}</option>)}</select></label>
 <label>Daga<input type="date" value={form.from} onChange={e=>field('from',e.target.value)}/></label><label>Zuwa<input type="date" value={form.to} onChange={e=>field('to',e.target.value)}/></label><button disabled={busy}>Duba / Sake dubawa</button></form>
 <p>Kwanan wata: lokacin Najeriya. Jimilla tana bin tacewar da ka zaba.</p>
 {busy&&<p role="status">Ana loda transactions...</p>}{error&&<p role="alert">{error}</p>}
 {report&&<><div className="transactions-summary"><strong>An biya: {money(report.paidAmount)}</strong><span>Paid: {report.paidCount}</span><span>Pending: {report.pendingCount}</span><span>Duka: {report.total}</span></div>
 <div className="transactions-table"><table><thead><tr>{['Lokaci','Customer','Film / Premium','Kudi','Hanya','Status','Reference'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{report.rows.map(r=><tr key={r.id}><td>{new Date(r.date).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})}</td><td>{r.customer}<small>{r.contact}</small></td><td>{r.item}<small>{r.kind}</small></td><td>{money(r.amount)}</td><td>{r.method}</td><td>{r.status}<small>{r.raw_status}</small></td><td>{r.reference}</td></tr>)}</tbody></table></div>
 {!report.rows.length&&<p>Babu transaction da ya dace da wannan binciken.</p>}
 <nav className="transactions-pages"><button disabled={busy||query.page<=1} onClick={()=>setQuery(q=>({...q,page:q.page-1}))}>Baya</button><span>Shafi {query.page} / {Math.max(1,Math.ceil(report.total/25))}</span><button disabled={busy||query.page*25>=report.total} onClick={()=>setQuery(q=>({...q,page:q.page+1}))}>Gaba</button></nav></>}
 </main>;
}
