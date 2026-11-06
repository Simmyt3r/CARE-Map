"use client";
import {useState} from "react";

export default function LoginForm(){
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(busy)return;
    setBusy(true);
    setMessage("");
    try{
      const response=await fetch("/api/auth/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,password}),
        credentials:"same-origin",
        cache:"no-store"
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok){
        setMessage(body?.error?.message||
          (response.status>=500?"Login is temporarily unavailable. Please try again later.":"Login failed."));
        return;
      }
      if(!body?.user?.role){
        setMessage("The server returned an incomplete sign-in response. Please try again.");
        return;
      }
      window.location.assign(body.user.role==="registered_community"?"/":body.user.role==="admin"?"/staff/admin/migrations":"/staff");
    }catch{
      setMessage("Unable to connect to CARE-Map. Check your network and try again.");
    }finally{
      setBusy(false);
    }
  }
  return <form className="card stack" onSubmit={submit}>
    <div className="field">
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="username" required value={email}
        onChange={e=>setEmail(e.target.value)}/>
    </div>
    <div className="field">
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" required value={password}
        onChange={e=>setPassword(e.target.value)}/>
    </div>
    <button className="btn primary" type="submit" disabled={busy}>
      {busy?"Signing in…":"Sign in"}
    </button>
    {message&&<div className="error" role="alert">{message}</div>}
  </form>;
}
