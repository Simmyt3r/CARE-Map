"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {PRIVACY_NOTICE_VERSION} from "@/lib/privacy";
import {useI18n} from "@/components/LocalizationProvider";

export default function RegisterForm(){
 const router=useRouter();
 const{t}=useI18n();
 const[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[privacyAcknowledged,setPrivacyAcknowledged]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);

 async function submit(e:React.FormEvent){
   e.preventDefault();setBusy(true);setMessage("");
   const r=await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,email,password,privacyAcknowledged,privacyNoticeVersion:PRIVACY_NOTICE_VERSION})});
   const j=await r.json().catch(()=>({}));setBusy(false);
   if(!r.ok)return setMessage(j.error?.message||t("register.failed"));
   router.push("/report");
 }

 return <form className="card stack" onSubmit={submit}>
   <div><h1>{t("register.title")}</h1><div className="muted">{t("register.subtitle")}</div></div>
   <div className="field"><label>{t("register.fullName")}</label><input required value={name} onChange={e=>setName(e.target.value)}/></div>
   <div className="field"><label>{t("register.email")}</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   <div className="field"><label>{t("register.password")}</label><input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></div>
   <label className="check-field privacy-check">
     <input type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)}/>
     <span>{t("register.privacyPrefix")} <Link href="/privacy" target="_blank">[{t("common.privacyNotice")}]</Link></span>
   </label>
   <button className="btn primary" disabled={busy||!privacyAcknowledged}>{busy?t("register.creating"):t("register.submit")}</button>
   {message&&<div className="error">{message}</div>}
 </form>;
}
