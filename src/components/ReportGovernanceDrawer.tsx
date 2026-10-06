"use client";
import {useEffect,useState} from "react";

type Staff={id:string;name:string;email:string;role:string;active:boolean};

export default function ReportGovernanceDrawer({report,staff,onClose,onUpdated}:{report:any;staff:Staff[];onClose:()=>void;onUpdated:()=>void}){
  const[details,setDetails]=useState<any>(null);
  const[priority,setPriority]=useState(report.priority||"medium");
  const[assignedTo,setAssignedTo]=useState(report.assigned_to||"");
  const[dueAt,setDueAt]=useState(report.due_at?new Date(report.due_at).toISOString().slice(0,16):"");
  const[status,setStatus]=useState(report.status||"submitted");
  const[note,setNote]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function load(){
    const r=await fetch("/api/reports/"+report.id+"/governance");
    const j=await r.json().catch(()=>({}));
    if(r.ok)setDetails(j.data);
  }
  useEffect(()=>{load();},[report.id]);

  async function saveGovernance(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/reports/"+report.id+"/governance",{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({priority,assignedTo:assignedTo||null,dueAt:dueAt?new Date(dueAt).toISOString():null})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Governance update failed.");
    setMessage("Ownership, priority and deadline updated.");
    await load();onUpdated();
  }

  async function changeStatus(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/reports/"+report.id+"/status",{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({status,notes:note||null})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Status update failed.");
    setNote("");setMessage("Status updated and added to history.");
    await load();onUpdated();
  }

  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <aside className="resource-drawer">
      <div className="section-head">
        <div><h2>Report governance</h2><div className="muted">{report.type} · {report.id.slice(0,8)}</div></div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      <div className="stack">
        <section className="drawer-section stack">
          <h3>Report</h3>
          <p>{report.description}</p>
          <div className="resource-facts">
            <div><span>Submitted</span><strong>{new Date(report.submitted_at).toLocaleString()}</strong></div>
            <div><span>Current status</span><strong>{report.status.replaceAll("_"," ")}</strong></div>
            <div><span>Location</span><strong>{Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}</strong></div>
            {report.related_entity_type&&<div><span>Linked resource</span><strong>{report.related_entity_type.replaceAll("_"," ")}</strong></div>}
          </div>
        </section>

        <section className="drawer-section stack">
          <h3>Ownership & urgency</h3>
          <div className="grid two">
            <div className="field"><label>Priority</label><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div className="field"><label>Assigned staff</label><select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id} disabled={!s.active}>{s.name} · {s.role}{!s.active?" (inactive)":""}</option>)}</select></div>
          </div>
          <div className="field"><label>Due date / time</label><input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></div>
          <button className="btn primary" disabled={busy} onClick={saveGovernance}>Save assignment</button>
        </section>

        <section className="drawer-section stack">
          <h3>Workflow update</h3>
          <div className="field"><label>New status</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="verified">Verified</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></div>
          <div className="field"><label>Status note</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="What changed, what was verified, or why this was resolved/rejected?"/></div>
          <button className="btn primary" disabled={busy} onClick={changeStatus}>Update status</button>
        </section>

        <section className="drawer-section stack">
          <div className="section-head"><h3>Status timeline</h3><span className="badge">{details?.history?.length||0}</span></div>
          <div className="timeline">
            {(details?.history||[]).map((h:any)=><div className="timeline-item" key={h.id}>
              <span className="timeline-dot"/>
              <div><strong>{h.from_status?h.from_status.replaceAll("_"," ")+" → ":""}{h.to_status.replaceAll("_"," ")}</strong><small>{new Date(h.created_at).toLocaleString()} · {h.actor_name||"System / community"}</small>{h.note&&<p>{h.note}</p>}</div>
            </div>)}
            {details&&!details.history?.length&&<div className="muted">No history recorded yet.</div>}
          </div>
        </section>

        {message&&<div className={message.includes("failed")?"error":"notice"}>{message}</div>}
      </div>
    </aside>
  </div>;
}
