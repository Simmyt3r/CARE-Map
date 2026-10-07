"use client";
import {useCallback,useEffect,useState} from "react";
import {
  dataSubjectRequestLabel,
  dataSubjectRequestStatuses,
  type DataSubjectRequestType
} from "@/lib/privacy";

export default function PrivacyGovernanceCenter(){
  const[requests,setRequests]=useState<any[]>([]);
  const[breaches,setBreaches]=useState<any[]>([]);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[breachForm,setBreachForm]=useState({
    title:"",description:"",detectedAt:"",likelyRisk:false,highRisk:false,
    affectedCategories:"",approximateSubjects:"",containmentActions:""
  });

  const load=useCallback(async()=>{
    const[rr,br]=await Promise.all([
      fetch("/api/admin/privacy/requests"),
      fetch("/api/admin/privacy/breaches")
    ]);
    const[rj,bj]=await Promise.all([rr.json().catch(()=>({})),br.json().catch(()=>({}))]);
    if(rr.ok)setRequests(rj.data||[]);
    if(br.ok)setBreaches(bj.data||[]);
  },[]);

  useEffect(()=>{void load();},[load]);

  async function patchRequest(id:string,body:Record<string,unknown>){
    setMessage("");
    const r=await fetch("/api/admin/privacy/requests/"+id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Privacy request update failed.");
    setMessage("Privacy request updated.");
    await load();
  }

  async function addBreach(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const r=await fetch("/api/admin/privacy/breaches",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        ...breachForm,
        approximateSubjects:breachForm.approximateSubjects?Number(breachForm.approximateSubjects):null
      })
    });
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Breach record could not be created.");
    setMessage("Breach record created. Review notification obligations immediately.");
    setBreachForm({title:"",description:"",detectedAt:"",likelyRisk:false,highRisk:false,affectedCategories:"",approximateSubjects:"",containmentActions:""});
    await load();
  }

  async function patchBreach(id:string,body:Record<string,unknown>){
    setMessage("");
    const r=await fetch("/api/admin/privacy/breaches/"+id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Breach update failed.");
    setMessage("Breach record updated.");
    await load();
  }

  const openRequests=requests.filter(r=>!["completed","rejected"].includes(r.status));
  const overdueRequests=openRequests.filter(r=>r.overdue);
  const openBreaches=breaches.filter(b=>b.status!=="closed");
  const notificationBreaches=openBreaches.filter(b=>b.ndpc_notification_required&&!b.ndpc_notified_at);

  return <div className="stack">
    <section className="card stack">
      <div className="section-head">
        <div><h1>Privacy & data governance</h1><div className="muted">Operational privacy cases, breach response, and evidence for formal NDPA/GAID review.</div></div>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      <div className="stats privacy-governance-stats">
        <div className="stat"><strong>{openRequests.length}</strong><span>Open rights requests</span></div>
        <div className="stat"><strong>{overdueRequests.length}</strong><span>Overdue requests</span></div>
        <div className="stat"><strong>{openBreaches.length}</strong><span>Open breach records</span></div>
        <div className="stat"><strong>{notificationBreaches.length}</strong><span>NDPC notification clocks</span></div>
      </div>
      <div className="notice"><strong>Legal-review status:</strong> this center prepares evidence and workflows but does not replace formal review by the responsible ACReSAL privacy/legal function or a qualified Nigerian data-protection professional.</div>
      {message&&<div className="notice">{message}</div>}
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Data-subject rights requests</h2><div className="muted">Target response date is 30 days from submission. Identity verification may be required before disclosure or erasure.</div></div><span className="badge">{requests.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Request</th><th>Requester</th><th>Status</th><th>Due</th><th>Case notes</th></tr></thead>
        <tbody>{requests.map(row=><tr key={row.id}>
          <td><strong>{row.reference_code}</strong><div className="muted">{new Date(row.submitted_at).toLocaleString()}</div></td>
          <td>{dataSubjectRequestLabel(row.request_type as DataSubjectRequestType)}<div className="muted clamp-2">{row.description}</div></td>
          <td>{row.requester_name}<div className="muted">{row.requester_email}</div>{row.requester_phone&&<div className="muted">{row.requester_phone}</div>}</td>
          <td><select value={row.status} onChange={e=>patchRequest(row.id,{status:e.target.value})}>{dataSubjectRequestStatuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></td>
          <td className={row.overdue?"overdue-text":""}><strong>{new Date(row.due_at).toLocaleDateString()}</strong>{row.overdue&&<div>OVERDUE</div>}</td>
          <td><details><summary className="btn">Review case</summary><div className="stack privacy-case-editor">
            <div className="field"><label>Identity-verification notes</label><textarea defaultValue={row.verification_notes||""} id={"verify-"+row.id}/></div>
            <div className="field"><label>Resolution notes</label><textarea defaultValue={row.resolution_notes||""} id={"resolve-"+row.id}/></div>
            <button className="btn primary" onClick={()=>{
              const verificationNotes=(document.getElementById("verify-"+row.id) as HTMLTextAreaElement|null)?.value||"";
              const resolutionNotes=(document.getElementById("resolve-"+row.id) as HTMLTextAreaElement|null)?.value||"";
              void patchRequest(row.id,{verificationNotes,resolutionNotes});
            }}>Save notes</button>
          </div></details></td>
        </tr>)}</tbody>
      </table></div>
      {!requests.length&&<div className="muted">No privacy-right requests have been submitted.</div>}
    </section>

    <section className="card stack">
      <div><h2>Record a personal-data breach or suspected breach</h2><div className="muted">Record incidents immediately. Mark whether the current assessment suggests risk or high risk; legal/privacy reviewers must confirm notification obligations.</div></div>
      <form className="stack" onSubmit={addBreach}>
        <div className="grid two">
          <div className="field"><label>Incident title</label><input required value={breachForm.title} onChange={e=>setBreachForm(x=>({...x,title:e.target.value}))}/></div>
          <div className="field"><label>Detected at</label><input required type="datetime-local" value={breachForm.detectedAt} onChange={e=>setBreachForm(x=>({...x,detectedAt:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Description</label><textarea required minLength={10} value={breachForm.description} onChange={e=>setBreachForm(x=>({...x,description:e.target.value}))}/></div>
        <div className="grid two">
          <div className="field"><label>Affected data categories</label><input value={breachForm.affectedCategories} onChange={e=>setBreachForm(x=>({...x,affectedCategories:e.target.value}))} placeholder="e.g. contact details, report location, account data"/></div>
          <div className="field"><label>Approximate affected people</label><input type="number" min={0} value={breachForm.approximateSubjects} onChange={e=>setBreachForm(x=>({...x,approximateSubjects:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Containment / response actions</label><textarea value={breachForm.containmentActions} onChange={e=>setBreachForm(x=>({...x,containmentActions:e.target.value}))}/></div>
        <div className="grid two">
          <label className="check-field"><input type="checkbox" checked={breachForm.likelyRisk} onChange={e=>setBreachForm(x=>({...x,likelyRisk:e.target.checked}))}/><span>Current assessment: likely risk to individuals. Start NDPC 72-hour notification tracking.</span></label>
          <label className="check-field"><input type="checkbox" checked={breachForm.highRisk} onChange={e=>setBreachForm(x=>({...x,highRisk:e.target.checked,likelyRisk:e.target.checked||x.likelyRisk}))}/><span>Current assessment: high risk. Track affected-person notification as well.</span></label>
        </div>
        <button className="btn primary" disabled={busy}>{busy?"Recording…":"Create breach record"}</button>
      </form>
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Breach response register</h2><div className="muted">The countdown is an operational reminder, not a substitute for legal assessment.</div></div><span className="badge">{breaches.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Incident</th><th>Assessment</th><th>72-hour clock</th><th>Notifications</th><th>Status</th></tr></thead>
        <tbody>{breaches.map(b=><tr key={b.id}>
          <td><strong>{b.title}</strong><div className="muted">{new Date(b.detected_at).toLocaleString()}</div><div className="muted clamp-2">{b.description}</div></td>
          <td>{b.high_risk?<span className="priority-badge priority-critical">high risk</span>:b.likely_risk?<span className="priority-badge priority-high">risk</span>:<span className="badge">assessment pending/low</span>}<div className="muted">{b.approximate_subjects==null?"Unknown people affected":Number(b.approximate_subjects).toLocaleString()+" people (approx.)"}</div></td>
          <td>{b.ndpc_notification_required&&!b.ndpc_notified_at?<strong className={Number(b.ndpc_hours_remaining)<=12?"overdue-text":""}>{Number(b.ndpc_hours_remaining||0).toFixed(1)} h remaining</strong>:b.ndpc_notified_at?<span className="success-inline">NDPC marked notified</span>:<span className="muted">Not currently flagged</span>}</td>
          <td><div className="actions compact-actions">
            {b.ndpc_notification_required&&!b.ndpc_notified_at&&<button className="btn" onClick={()=>patchBreach(b.id,{ndpcNotified:true})}>Mark NDPC notified</button>}
            {b.subjects_notification_required&&!b.subjects_notified_at&&<button className="btn" onClick={()=>patchBreach(b.id,{subjectsNotified:true})}>Mark people notified</button>}
          </div></td>
          <td><select value={b.status} onChange={e=>patchBreach(b.id,{status:e.target.value})}><option value="open">open</option><option value="contained">contained</option><option value="closed">closed</option></select></td>
        </tr>)}</tbody>
      </table></div>
      {!breaches.length&&<div className="muted">No breach records.</div>}
    </section>

    <section className="card stack">
      <h2>Compliance preparation checklist</h2>
      <div className="checklist privacy-checklist">
        <div><span>1</span>Confirm the legal identity of the CARE-Map data controller and publish its contact/address.</div>
        <div><span>2</span>Confirm lawful bases for each processing activity and document processors/cross-border transfers.</div>
        <div><span>3</span>Complete DPIA assessment for location, imagery, monitoring, analytics, and any high-risk processing.</div>
        <div><span>4</span>Confirm NDPC registration/filing obligations and whether a DPO/DPCO is required for the operating entity.</div>
        <div><span>5</span>Approve retention schedule against ACReSAL/government/World Bank records obligations.</div>
        <div><span>6</span>Review public notice, rights workflow, breach procedure, contracts, and security controls before launch.</div>
      </div>
    </section>
  </div>;
}
