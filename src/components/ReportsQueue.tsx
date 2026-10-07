"use client";
import {useEffect,useMemo,useState} from "react";
import ReportGovernanceDrawer from "@/components/ReportGovernanceDrawer";

export default function ReportsQueue(){
  const[rows,setRows]=useState<any[]>([]);
  const[staff,setStaff]=useState<any[]>([]);
  const[selected,setSelected]=useState<any|null>(null);
  const[filter,setFilter]=useState("open");
  const[message,setMessage]=useState("");
  const[now,setNow]=useState<number|null>(null);

  async function load(){
    const r=await fetch("/api/reports");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Reports could not be loaded.");
    setRows(j.data||[]);
    setStaff(j.staff||[]);
  }

  useEffect(()=>{load();setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer);},[]);

  const visible=useMemo(()=>rows.filter(r=>{
    if(filter==="open")return !["resolved","rejected"].includes(r.status);
    if(filter==="unassigned")return !["resolved","rejected"].includes(r.status)&&!r.assigned_to;
    if(filter==="overdue")return !["resolved","rejected"].includes(r.status)&&r.due_at&&now!==null&&new Date(r.due_at).getTime()<now;
    if(filter==="critical")return !["resolved","rejected"].includes(r.status)&&r.priority==="critical";
    if(filter==="satellite")return r.origin==="satellite_alert";
    if(filter==="closed")return ["resolved","rejected"].includes(r.status);
    return true;
  }),[rows,filter,now]);

  function dueLabel(r:any){
    if(!r.due_at)return "No deadline";
    const due=new Date(r.due_at);
    const overdue=now!==null&&!["resolved","rejected"].includes(r.status)&&due.getTime()<now;
    return (overdue?"OVERDUE · ":"")+due.toLocaleString();
  }

  return <div className="stack">
    <div className="staff-tabs">
      <button className="btn" onClick={()=>setFilter("open")}>Open</button>
      <button className="btn" onClick={()=>setFilter("unassigned")}>Unassigned</button>
      <button className="btn" onClick={()=>setFilter("overdue")}>Overdue</button>
      <button className="btn" onClick={()=>setFilter("critical")}>Critical</button>
      <button className="btn" onClick={()=>setFilter("satellite")}>Satellite</button>
      <button className="btn" onClick={()=>setFilter("closed")}>Closed</button>
      <button className="btn" onClick={()=>setFilter("all")}>All</button>
    </div>

    {message&&<div className="error">{message}</div>}

    <div className="card">
      <div className="section-head">
        <div><h2>Report queue</h2><div className="muted">Sorted by priority. Open a report to assign an owner, deadline and status note.</div></div>
        <span className="badge">{visible.length}</span>
      </div>

      <div className="table-wrap"><table>
        <thead><tr><th>Report</th><th>Priority</th><th>Owner</th><th>Status</th><th>Deadline</th><th>Action</th></tr></thead>
        <tbody>{visible.map(r=><tr key={r.id} className={r.priority==="critical"?"critical-row":""}>
          <td><strong>{r.type.replaceAll("_"," ")}</strong>{r.origin==="satellite_alert"&&<span className="badge satellite-badge">Satellite verification</span>}<div className="muted clamp-2">{r.description}</div><small>{new Date(r.submitted_at).toLocaleString()}</small></td>
          <td><span className={"priority-badge priority-"+r.priority}>{r.priority}</span></td>
          <td>{r.assigned_name||<span className="muted">Unassigned</span>}</td>
          <td><span className="badge">{r.status.replaceAll("_"," ")}</span></td>
          <td className={r.due_at&&!["resolved","rejected"].includes(r.status)&&now!==null&&new Date(r.due_at).getTime()<now?"overdue-text":""}>{dueLabel(r)}</td>
          <td><button className="btn" onClick={()=>setSelected(r)}>Manage</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>

    {selected&&<ReportGovernanceDrawer report={selected} staff={staff} onClose={()=>setSelected(null)} onUpdated={load}/>}
  </div>;
}
