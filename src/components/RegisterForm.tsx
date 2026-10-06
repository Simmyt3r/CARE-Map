"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";

export default function RegisterForm(){
 const router=useRouter();
 const[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
   e.preventDefault();setBusy(true);setMessage("");
   const r=await fetch("/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,email,password})});
   const j=await r.json().catch(()=>({}));setBusy(false);
   if(!r.ok)return setMessage(j.error?.message||"Registration failed.");
   router.push("/report");
 }
 return <form className="card stack" onSubmit={submit}><div className="field"><label>Full name</label><input required value={name} onChange={e=>setName(e.target.value)}/></div><div className="field"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Password</label><input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></div><button className="btn primary" disabled={busy}>{busy?"Creating…":"Create community account"}</button>{message&&<div className="error">{message}</div>}</form>;
}
