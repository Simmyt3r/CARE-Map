"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

export default function PrivacyAccountControls(){
  const router=useRouter();
  const[confirm,setConfirm]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function exportData(){
    setMessage("");
    const r=await fetch("/api/privacy/me/export");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Personal data export failed.");
    const blob=new Blob([JSON.stringify(j,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="care-map-my-data.json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  async function erase(){
    if(confirm.toUpperCase()!=="DELETE")return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/privacy/me/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({confirmation:confirm})});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Account erasure failed.");
    router.push("/");
    router.refresh();
  }

  return <section className="card stack">
    <div><h2>Privacy & account data</h2><div className="muted">Use self-service tools for your community account. Complex requests can be submitted from the Privacy page.</div></div>
    <div className="actions"><button className="btn" onClick={exportData}>Download my CARE-Map data</button><a className="btn" href="/privacy">Privacy notice & rights requests</a></div>
    <div className="privacy-danger">
      <strong>Erase community account identity</strong>
      <p>This anonymizes your account and removes optional reporter name/contact fields from reports linked to it. De-identified operational report records may remain where required for project tracking.</p>
      <div className="secret-row"><input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Type DELETE"/><button className="btn danger" disabled={busy||confirm.toUpperCase()!=="DELETE"} onClick={erase}>{busy?"Erasing…":"Erase my account"}</button></div>
    </div>
    {message&&<div className="notice">{message}</div>}
  </section>;
}
