"use client";
import {useState} from "react";
export default function LoginForm(){
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});const j=await r.json().catch(()=>({}));setBusy(false);if(!r.ok)return setMessage(j.error?.message||"Login failed.");location.href=j.user?.role==="registered_community"?"/":"/staff";}
 return <form className="card stack" onSubmit={submit}><div className="field"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Password</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><button className="btn primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>{message&&<div className="error">{message}</div>}</form>;
}
