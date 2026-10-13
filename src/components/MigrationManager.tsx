"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";

export type MigrationOverview={
  databaseReady:boolean;
  databaseName:string|null;
  expected:number;
  applied:number;
  pending:string[];
  checksumMismatches:string[];
  latestAppliedAt:string|null;
};

export default function MigrationManager({overview}:{overview:MigrationOverview}){
  const router=useRouter();
  const[busy,setBusy]=useState(false);
  const[result,setResult]=useState<{ok:boolean;message:string}|null>(null);
  const ready=overview.databaseReady&&overview.checksumMismatches.length===0;
  const hasPending=overview.pending.length>0;
  async function apply(){
    if(busy||!ready||!hasPending)return;
    const confirmed=window.confirm(
      "Apply "+overview.pending.length+" pending migration(s) to the configured Aiven database? "+
      "This will change the database schema. Confirm the backup and approval are in place."
    );
    if(!confirmed)return;
    setBusy(true);
    setResult(null);
    try{
      const response=await fetch("/api/admin/schema-upgrade",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        cache:"no-store",
        credentials:"same-origin"
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        throw new Error(response.status===401||response.status===403
          ?"Your administrator session is no longer valid. Sign in again to continue."
          :String(data.message||"Migration failed. Review server logs."));
      }
      const count=Number(data.data?.appliedNow||0);
      setResult({ok:true,message:count
        ?count+" database migration(s) applied. Refreshing the status…"
        :"Database schema is already up to date."});
      router.refresh();
    }catch(e){
      setResult({ok:false,message:e instanceof Error?e.message:"Database migration failed."});
    }finally{setBusy(false);}
  }
  return <section className="card stack">
    <div className="section-head">
      <div>
        <h2>Admin database migrations</h2>
        <p className="muted" style={{margin:"6px 0 0"}}>
          Uses your existing administrator session and the Aiven credentials already saved on the server.
          No additional database password, setup token or sign-in form.
        </p>
      </div>
      <span className="badge">{overview.applied} / {overview.expected} applied</span>
    </div>
    <div className="grid three">
      <div className="stat"><strong>{overview.pending.length}</strong><span>Pending migrations</span></div>
      <div className="stat"><strong>{overview.applied}</strong><span>Applied migrations</span></div>
      <div className="stat"><strong>{overview.checksumMismatches.length}</strong><span>Integrity conflicts</span></div>
    </div>
    <div className="muted">Database: <strong>{overview.databaseName||"Not configured"}</strong> ·
      {overview.databaseReady?" Connected":" Connection unavailable"}
      {overview.latestAppliedAt?" · Last migration: "+new Date(overview.latestAppliedAt).toLocaleString():""}
    </div>
    {overview.checksumMismatches.length>0&&<div className="error" role="alert">
      <strong>Migration checksum conflict.</strong> An existing migration has changed since it was applied.
      Deployment is blocked until the historical file is restored or reviewed.
      <div>{overview.checksumMismatches.join(", ")}</div>
    </div>}
    {!overview.databaseReady&&<div className="error" role="alert">
      The configured database is unavailable. Check Aiven and Vercel environment settings. No new credentials need to be typed here.
    </div>}
    {hasPending?<div className="stack">
      <div><strong>Pending files</strong>
        <ul className="migration-pending-list">
          {overview.pending.map(filename=><li key={filename}><code>{filename}</code></li>)}
        </ul>
      </div>
      <div className="actions">
        <button className="btn primary" type="button" disabled={!ready||busy} onClick={()=>void apply()}>
          {busy?"Applying migrations…":"Apply "+overview.pending.length+" pending migration(s)"}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={()=>router.refresh()}>Refresh status</button>
      </div>
      <small className="muted">This action only runs unapplied migration files. Existing files are checked using the migration ledger and SHA-256 checksums.</small>
    </div>:<div className="success" role="status"><strong>No pending migrations.</strong> The database schema ledger is up to date.</div>}
    {result&&<div role="status" className={result.ok?"success":"error"}>{result.message}</div>}
  </section>;
}
