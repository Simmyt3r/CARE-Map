"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {PRIVACY_NOTICE_VERSION} from "@/lib/privacy";

export default function RegisterForm(){
 const router=useRouter();
 const[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[privacyAcknowledged,setPrivacyAcknowledged]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);

 async function submit(e:React.FormEvent){
   e.preventDefault();setBusy(true);setMessage("");
   const r=await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,email,password,privacyAcknowledged,privacyNoticeVersion:PRIVACY_NOTICE_VERSION})});
   const j=await r.json().catch(()=>({}));setBusy(false);
   if(!r.ok)return setMessage(j.error?.message||"Registration failed.");
   router.push("/report");
 }

 return <form className="card stack" onSubmit={submit}>
   <div className="field"><label>Full name</label><input required value={name} onChange={e=>setName(e.target.value)}/></div>
   <div className="field"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   <div className="field"><label>Password</label><input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></div>
   <label className="check-field privacy-check">
     <input type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)}/>
     <span>I have read the <Link href="/privacy" target="_blank">CARE-Map privacy notice</Link> and understand how my account data and reports are processed.</span>
   </label>
   <button className="btn primary" disabled={busy||!privacyAcknowledged}>{busy?"Creating…":"Create community account"}</button>
   {message&&<div className="error">{message}</div>}
 </form>;
}
