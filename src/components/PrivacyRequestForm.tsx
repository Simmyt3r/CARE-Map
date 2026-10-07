"use client";
import {useState} from "react";
import {dataSubjectRequestLabel,dataSubjectRequestTypes,type DataSubjectRequestType} from "@/lib/privacy";

export default function PrivacyRequestForm(){
  const[form,setForm]=useState({requestType:"access",name:"",email:"",phone:"",description:""});
  const[reference,setReference]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[lookup,setLookup]=useState({reference:"",email:""});
  const[status,setStatus]=useState<any|null>(null);

  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");setReference("");
    const r=await fetch("/api/privacy/requests",{
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)
    });
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Privacy request could not be submitted.");
    setReference(j.data.reference);
    setLookup({reference:j.data.reference,email:form.email});
    setMessage("Privacy request submitted. Keep the reference below for status checks.");
  }

  async function checkStatus(e:React.FormEvent){
    e.preventDefault();setStatus(null);setMessage("");
    const qs=new URLSearchParams({reference:lookup.reference,email:lookup.email});
    const r=await fetch("/api/privacy/requests?"+qs);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Could not check privacy request status.");
    setStatus(j.data);
  }

  return <div className="grid two privacy-request-grid">
    <form className="card stack" onSubmit={submit}>
      <div><h2>Exercise a privacy right</h2><div className="muted">You do not need an account to submit a request. We may ask for enough information to verify identity before disclosing or changing personal data.</div></div>
      <div className="field"><label>Request type</label><select value={form.requestType} onChange={e=>set("requestType",e.target.value)}>
        {dataSubjectRequestTypes.map(t=><option key={t} value={t}>{dataSubjectRequestLabel(t as DataSubjectRequestType)}</option>)}
      </select></div>
      <div className="field"><label>Full name</label><input required minLength={2} value={form.name} onChange={e=>set("name",e.target.value)}/></div>
      <div className="field"><label>Email</label><input required type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
      <div className="field"><label>Phone (optional)</label><input value={form.phone} onChange={e=>set("phone",e.target.value)}/></div>
      <div className="field"><label>What are you requesting?</label><textarea required minLength={10} maxLength={5000} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe the account, report, contact information, correction, deletion, objection, or other privacy issue."/></div>
      <div className="notice">This form is used only to identify, verify, and respond to your privacy request. CARE-Map targets a response within 30 days, subject to identity verification and lawful exceptions.</div>
      <button className="btn primary" disabled={busy}>{busy?"Submitting…":"Submit privacy request"}</button>
      {reference&&<div className="success"><strong>Reference:</strong> {reference}</div>}
    </form>

    <form className="card stack" onSubmit={checkStatus}>
      <div><h2>Check request status</h2><div className="muted">Use the request reference and the same email address used when submitting it.</div></div>
      <div className="field"><label>Reference</label><input required value={lookup.reference} onChange={e=>setLookup(x=>({...x,reference:e.target.value.toUpperCase()}))} placeholder="PRV-YYYYMMDD-XXXXXXXXXXXX"/></div>
      <div className="field"><label>Email</label><input required type="email" value={lookup.email} onChange={e=>setLookup(x=>({...x,email:e.target.value}))}/></div>
      <button className="btn">Check status</button>
      {status&&<div className="resource-facts">
        <div><span>Reference</span><strong>{status.reference_code}</strong></div>
        <div><span>Request</span><strong>{String(status.request_type).replaceAll("_"," ")}</strong></div>
        <div><span>Status</span><strong>{String(status.status).replaceAll("_"," ")}</strong></div>
        <div><span>Submitted</span><strong>{new Date(status.submitted_at).toLocaleDateString()}</strong></div>
        <div><span>Target date</span><strong>{new Date(status.due_at).toLocaleDateString()}</strong></div>
        <div><span>Completed</span><strong>{status.completed_at?new Date(status.completed_at).toLocaleDateString():"—"}</strong></div>
      </div>}
      {message&&<div className={reference?"success":"notice"}>{message}</div>}
    </form>
  </div>;
}
