"use client";
import {useEffect,useState} from "react";

export default function OperationsCenter(){
  const[data,setData]=useState<any|null>(null);
  const[message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/api/operations/summary");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Operations summary could not be loaded.");
    setData(j.data);
  }

  useEffect(()=>{load();},[]);

  const s=data?.summary||{};
  return <div className="stack">
    {message&&<div className="error">{message}</div>}

    <div className="stats">
      <div className="stat"><strong>{s.open_reports??"–"}</strong><span>Open reports</span></div>
      <div className="stat"><strong>{s.unassigned??"–"}</strong><span>Unassigned</span></div>
      <div className="stat"><strong>{s.overdue??"–"}</strong><span>Overdue</span></div>
      <div className="stat"><strong>{s.critical??"–"}</strong><span>Critical priority</span></div>
    </div>

    <section className="card">
      <div className="section-head">
        <div><h2>Action needed</h2><div className="muted">Open reports ordered by urgency, overdue state and age.</div></div>
        <a className="btn primary" href="/staff/reports">Open report workflow</a>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Priority</th><th>Report</th><th>Owner</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>{(data?.queue||[]).map((r:any)=><tr key={r.id} className={r.priority==="critical"?"critical-row":""}>
          <td><span className={"priority-badge priority-"+r.priority}>{r.priority}</span></td>
          <td><strong>{r.type.replaceAll("_"," ")}</strong><div className="muted clamp-2">{r.description}</div><small>{new Date(r.submitted_at).toLocaleString()}</small></td>
          <td>{r.assigned_name||<span className="muted">Unassigned</span>}</td>
          <td><span className="badge">{r.status.replaceAll("_"," ")}</span></td>
          <td className={r.due_at&&new Date(r.due_at).getTime()<Date.now()?"overdue-text":""}>{r.due_at?new Date(r.due_at).toLocaleString():"No deadline"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Recent GIS imports</h2><div className="muted">Latest bulk data loads and their success/failure counts.</div></div><a className="btn" href="/staff/gis">GIS Workbench</a></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Format</th><th>Imported</th><th>Failed</th><th>By</th></tr></thead>
        <tbody>{(data?.imports||[]).map((i:any)=><tr key={i.id}><td>{new Date(i.created_at).toLocaleString()}</td><td>{i.kind}</td><td>{i.format}</td><td>{i.imported_rows}/{i.total_rows}</td><td className={Number(i.failed_rows)>0?"overdue-text":""}>{i.failed_rows}</td><td>{i.created_by_name||"Unknown"}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
