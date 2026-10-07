"use client";
import Link from "next/link";
import {useState} from "react";

export default function SatelliteVerificationAction({alert,onUpdated}:{alert:any;onUpdated:()=>void|Promise<void>}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  async function createTask(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/alerts/"+alert.id+"/field-verification",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:"{}"
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not create field verification.");
    setMessage(j.data.created?"Field verification task created.":"Field verification task already exists.");
    await onUpdated();
  }

  if(alert.verification_report_id){
    return <div className="verification-action">
      <span className={"priority-badge priority-"+(alert.verification_status==="resolved"?"low":alert.verification_priority||"medium")}>
        Field task · {(alert.verification_status||"submitted").replaceAll("_"," ")}
      </span>
      <Link className="btn" href="/staff/reports">Open reports</Link>
    </div>;
  }

  return <div className="verification-action">
    <button className="btn primary" disabled={busy} onClick={createTask}>{busy?"Creating…":"Create field verification"}</button>
    {message&&<small className="muted">{message}</small>}
  </div>;
}
