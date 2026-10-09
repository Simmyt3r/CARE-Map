"use client";

import {useState} from "react";
import Link from "next/link";

export default function FirstSetupPage() {
 const [token,setToken]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<{ok:boolean;message:string;migrations?:number;appliedNow?:number;skipped?:number}|null>(null);
 async function run(){
   if (busy || token.length<32) return;
   if (!window.confirm("Initialize the configured CARE-Map database and create the first administrator? This modifies your Aiven database.")) return;
   setBusy(true);setResult(null);
   try {
     const res=await fetch("/api/first-setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),cache:"no-store"});
     const data=await res.json();
     setResult(data);
     if(res.ok)setToken("");
   } catch {
     setResult({ok:false,message:"Network error. Check the deployment and try again after checking database status."});
   } finally {setBusy(false);}
 }
 return <main className="stack" style={{maxWidth:760,margin:"2rem auto",padding:"1rem"}}>
  <div className="stack">
   <p className="muted">CARE-Map / First-time deployment</p>
   <h1>Set up your database</h1>
   <p className="muted">No laptop terminal needed. This secure one-time page uses the configuration already saved in Vercel to initialize PostGIS, apply migrations and create your first administrator.</p>
  </div>
  <section className="card stack">
   <h2>Before you begin</h2>
   <ol>
    <li>In Vercel → care-map → Settings → Environment Variables, configure <code>DATABASE_URL</code>, <code>AIVEN_CA_CERT</code>, <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code>.</li>
    <li>Generate and add a new random <code>SETUP_TOKEN</code> (at least 32 characters), plus separate <code>SESSION_SECRET</code> and <code>CRON_SECRET</code>.</li>
    <li>Choose the Production environment for each variable. Redeploy the latest GitHub commit.</li>
    <li>Ensure the Aiven PostgreSQL service is running.</li>
   </ol>
   <p className="muted">The administrator password must be 12+ characters and should be newly rotated. The setup key is never stored in the browser by this page.</p>
  </section>
  <section className="card stack">
   <h2>Run first-time setup</h2>
   <label htmlFor="setup-token">Temporary setup key</label>
   <input id="setup-token" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste SETUP_TOKEN from your private password manager"/>
   <button className="btn primary" disabled={busy||token.length<32} onClick={run}>{busy?"Initializing database…":"Initialize database and administrator"}</button>
   {result&&<div role="status" aria-live="polite" className={result.ok?"success":"error"}>
    <strong>{result.ok?"Setup completed":"Setup not completed"}</strong>
    <p>{result.message}</p>
    {result.ok&&<p>Migration files: {result.migrations} · Newly applied: {result.appliedNow} · Already applied: {result.skipped}</p>}
   </div>}
  </section>
  <section className="card stack">
   <h2>After success</h2>
   <p>Immediately delete <code>SETUP_TOKEN</code> and <code>ADMIN_PASSWORD</code> from Vercel Production environment variables, then redeploy. Keep <code>DATABASE_URL</code>, <code>AIVEN_CA_CERT</code>, <code>SESSION_SECRET</code> and <code>CRON_SECRET</code>.</p>
   <p>Sign in using the administrator email and password you configured, then open Staff → Infrastructure to check remaining production readiness gates.</p>
   <Link href="/login">Go to sign in</Link>
  </section>
 </main>;
}
