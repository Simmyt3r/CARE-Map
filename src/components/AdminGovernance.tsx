"use client";
import {useEffect,useState} from "react";

export default function AdminGovernance(){
  const[audit,setAudit]=useState<any[]>([]);
  const[imports,setImports]=useState<any[]>([]);
  const[action,setAction]=useState("");
  const[entityType,setEntityType]=useState("");
  const[message,setMessage]=useState("");

  async function loadAudit(){
    const qs=new URLSearchParams();
    if(action)qs.set("action",action);
    if(entityType)qs.set("entityType",entityType);
    const r=await fetch("/api/admin/audit?"+qs);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Audit log could not be loaded.");
    setAudit(j.data||[]);
  }

  async function loadImports(){
    const r=await fetch("/api/admin/import-jobs");
    const j=await r.json().catch(()=>({}));
    if(r.ok)setImports(j.data||[]);
  }

  useEffect(()=>{loadAudit();loadImports();},[]);

  return <div className="stack">
    {message&&<div className="error">{message}</div>}

    <section className="card stack">
      <div className="section-head"><div><h2>Audit log</h2><div className="muted">Who changed what, when, and on which entity.</div></div><span className="badge">{audit.length}</span></div>
      <div className="filters">
        <div className="field"><label>Action</label><input value={action} onChange={e=>setAction(e.target.value)} placeholder="e.g. update, status_change"/></div>
        <div className="field"><label>Entity type</label><input value={entityType} onChange={e=>setEntityType(e.target.value)} placeholder="e.g. report, boreholes"/></div>
        <div className="field"><label>Refresh</label><button className="btn" onClick={loadAudit}>Apply filters</button></div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>{audit.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor_name||"System"}<div className="muted">{a.actor_email||""}</div></td><td><span className="badge">{a.action}</span></td><td>{a.entity_type}<div className="muted">{a.entity_id||""}</div></td><td><code>{JSON.stringify(a.metadata||{})}</code></td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Import history</h2><div className="muted">Bulk GIS imports, including row-level failures retained for review.</div></div><span className="badge">{imports.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Time</th><th>By</th><th>Dataset</th><th>Format</th><th>Imported</th><th>Failed</th><th>Error sample</th></tr></thead>
        <tbody>{imports.map(i=><tr key={i.id}><td>{new Date(i.created_at).toLocaleString()}</td><td>{i.created_by_name||"Unknown"}</td><td>{i.kind}</td><td>{i.format}</td><td>{i.imported_rows}/{i.total_rows}</td><td className={Number(i.failed_rows)>0?"overdue-text":""}>{i.failed_rows}</td><td><code>{Array.isArray(i.errors)&&i.errors.length?JSON.stringify(i.errors.slice(0,2)):"—"}</code></td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
