"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import SatelliteVerificationAction from "@/components/SatelliteVerificationAction";

export default function OperationsCenter(){
  const[data,setData]=useState<any|null>(null);
  const[message,setMessage]=useState("");
  const[now,setNow]=useState<number|null>(null);

  async function load(){
    const r=await fetch("/api/operations/summary");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Operations summary could not be loaded.");
    setData(j.data);
  }

  useEffect(()=>{load();setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer);},[]);

  async function acknowledgeVegetation(id:string){
    setMessage("");
    const r=await fetch("/api/remote-sensing/alerts/"+id+"/acknowledge",{method:"POST"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Vegetation alert acknowledgement failed.");
    setMessage("Vegetation alert acknowledged.");
    await load();
  }

  const s=data?.summary||{};
  return <div className="stack">
    {message&&<div className="error">{message}</div>}

    <div className="stats">
      <div className="stat"><strong>{s.open_reports??"–"}</strong><span>Open reports</span></div>
      <div className="stat"><strong>{s.unassigned??"–"}</strong><span>Unassigned</span></div>
      <div className="stat"><strong>{s.overdue??"–"}</strong><span>Overdue</span></div>
      <div className="stat"><strong>{s.critical??"–"}</strong><span>Critical reports</span></div>
      <div className="stat"><strong>{s.open_vegetation_alerts??"–"}</strong><span>Vegetation alerts</span></div>
    </div>

    {!!data?.vegetationAlerts?.length&&<section className="card">
      <div className="section-head">
        <div><h2>Satellite vegetation alerts</h2><div className="muted">Clear-pixel Sentinel-2 observations that crossed a monitoring plan&apos;s vegetation-loss threshold.</div></div>
        <Link className="btn" href="/staff/remote-sensing/monitoring">Vegetation monitoring</Link>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Severity</th><th>Alert</th><th>Observed</th><th>Change</th><th>Clear coverage</th><th></th></tr></thead>
        <tbody>{data.vegetationAlerts.map((a:any)=><tr key={a.id} className={a.severity==="critical"?"critical-row":""}>
          <td><span className={"priority-badge priority-"+a.severity}>{a.severity}</span></td>
          <td><strong>{a.title}</strong><div className="muted clamp-2">{a.message}</div></td>
          <td>{String(a.observed_for).slice(0,10)}<div className="muted">{a.monitor_name}</div></td>
          <td className="overdue-text">{Number(a.vegetation_change_pct).toFixed(1)}%<div className="muted">{Number(a.vegetation_change_ha).toFixed(1)} ha</div></td>
          <td>{a.clear_fraction==null?"—":(Number(a.clear_fraction)*100).toFixed(0)+"%"}</td>
          <td><div className="stack compact-stack"><SatelliteVerificationAction alert={a} onUpdated={load}/><button className="btn" onClick={()=>acknowledgeVegetation(a.id)}>Acknowledge alert</button></div></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    <section className="card">
      <div className="section-head">
        <div><h2>Action needed</h2><div className="muted">Open reports ordered by urgency, overdue state and age.</div></div>
        <Link className="btn primary" href="/staff/reports">Open report workflow</Link>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Priority</th><th>Report</th><th>Owner</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>{(data?.queue||[]).map((r:any)=><tr key={r.id} className={r.priority==="critical"?"critical-row":""}>
          <td><span className={"priority-badge priority-"+r.priority}>{r.priority}</span></td>
          <td><strong>{r.type.replaceAll("_"," ")}</strong><div className="muted clamp-2">{r.description}</div><small>{new Date(r.submitted_at).toLocaleString()}</small></td>
          <td>{r.assigned_name||<span className="muted">Unassigned</span>}</td>
          <td><span className="badge">{r.status.replaceAll("_"," ")}</span></td>
          <td className={r.due_at&&now!==null&&new Date(r.due_at).getTime()<now?"overdue-text":""}>{r.due_at?new Date(r.due_at).toLocaleString():"No deadline"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Recent GIS imports</h2><div className="muted">Latest bulk data loads and their success/failure counts.</div></div><Link className="btn" href="/staff/gis">GIS Workbench</Link></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Format</th><th>Imported</th><th>Failed</th><th>By</th></tr></thead>
        <tbody>{(data?.imports||[]).map((i:any)=><tr key={i.id}><td>{new Date(i.created_at).toLocaleString()}</td><td>{i.kind}</td><td>{i.format}</td><td>{i.imported_rows}/{i.total_rows}</td><td className={Number(i.failed_rows)>0?"overdue-text":""}>{i.failed_rows}</td><td>{i.created_by_name||"Unknown"}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
