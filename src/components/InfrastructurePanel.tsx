"use client";
import {useMemo,useState,useTransition} from "react";
import {bootstrapAdminAction,initializeAivenAction,testAivenAction,type InfraActionResult} from "@/app/staff/infrastructure/actions";

type Snapshot={
  environment:string;
  databaseConfigured:boolean;
  caConfigured:boolean;
  sessionSecretConfigured:boolean;
  cronSecretConfigured:boolean;
  adminSeedConfigured:boolean;
  databaseHost:string|null;
  databaseName:string|null;
  database:{ok:boolean;postgresVersion?:string;postgisEnabled?:boolean;postgisVersion?:string|null;tables?:number;error?:string};
};

function randomSecret(bytes=32){
  const a=new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
}

function Status({ok,label}:{ok:boolean;label:string}){
  return <div className={"setup-status "+(ok?"ok":"missing")}><span>{ok?"✓":"!"}</span><div><strong>{label}</strong><small>{ok?"Ready":"Needs configuration"}</small></div></div>;
}

function escapeEnv(value:string){
  return value.replaceAll('"','\\\"');
}

export default function InfrastructurePanel({snapshot}:{snapshot:Snapshot}){
  const[databaseUrl,setDatabaseUrl]=useState("");
  const[caCert,setCaCert]=useState("");
  const[sessionSecret,setSessionSecret]=useState(()=>randomSecret(32));
  const[cronSecret,setCronSecret]=useState(()=>randomSecret(32));
  const[adminName,setAdminName]=useState("CARE-Map Administrator");
  const[adminEmail,setAdminEmail]=useState("");
  const[adminPassword,setAdminPassword]=useState("");
  const[result,setResult]=useState<InfraActionResult|null>(null);
  const[pending,startTransition]=useTransition();

  const envBundle=useMemo(()=>{
    const lines:string[]=[];
    if(databaseUrl)lines.push('DATABASE_URL="'+escapeEnv(databaseUrl)+'"');
    if(caCert)lines.push('AIVEN_CA_CERT="'+escapeEnv(caCert.replaceAll("\n","\\n"))+'"');
    if(sessionSecret)lines.push('SESSION_SECRET="'+sessionSecret+'"');
    if(cronSecret)lines.push('CRON_SECRET="'+cronSecret+'"');
    if(adminEmail)lines.push('ADMIN_EMAIL="'+escapeEnv(adminEmail)+'"');
    if(adminPassword)lines.push('ADMIN_PASSWORD="'+escapeEnv(adminPassword)+'"');
    return lines.join("\n");
  },[databaseUrl,caCert,sessionSecret,cronSecret,adminEmail,adminPassword]);

  function run(fn:()=>Promise<InfraActionResult>){
    setResult(null);
    startTransition(()=>{void fn().then(setResult).catch(e=>setResult({ok:false,message:e instanceof Error?e.message:"Action failed."}));});
  }

  async function copy(text:string){
    await navigator.clipboard.writeText(text);
    setResult({ok:true,message:"Copied to clipboard."});
  }

  return <div className="stack">
    <section className="card">
      <div className="section-head"><div><h2>Production readiness</h2><div className="muted">Current server environment. Secret values are never displayed.</div></div><span className="badge">{snapshot.environment}</span></div>
      <div className="setup-status-grid">
        <Status ok={snapshot.databaseConfigured&&snapshot.database.ok} label="Aiven database"/>
        <Status ok={snapshot.caConfigured} label="Aiven CA certificate"/>
        <Status ok={snapshot.sessionSecretConfigured} label="Session signing secret"/>
        <Status ok={snapshot.cronSecretConfigured} label="Cron secret"/>
      </div>
      {snapshot.databaseConfigured&&<div className="notice">Configured database: <strong>{snapshot.databaseHost||"unknown host"}</strong> / {snapshot.databaseName||"unknown database"} · {snapshot.database.ok?"reachable":"unreachable"}{snapshot.database.postgisEnabled?" · PostGIS "+(snapshot.database.postgisVersion||""):""}</div>}
      {!snapshot.database.ok&&snapshot.database.error&&<div className="error">{snapshot.database.error}</div>}
    </section>

    <section className="card stack">
      <div><h2>1. Aiven PostgreSQL + PostGIS</h2><div className="muted">Paste the Aiven service URI and CA certificate. Values are submitted only when you test or initialize the database.</div></div>
      <div className="field"><label>Aiven PostgreSQL service URI</label><input type="password" autoComplete="off" value={databaseUrl} onChange={e=>setDatabaseUrl(e.target.value)} placeholder="postgresql://avnadmin:••••@host:port/defaultdb?sslmode=require"/></div>
      <div className="field"><label>Aiven CA certificate</label><textarea value={caCert} onChange={e=>setCaCert(e.target.value)} placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}/></div>
      <div className="actions">
        <button className="btn" disabled={pending||!databaseUrl} onClick={()=>run(()=>testAivenAction({databaseUrl,caCert}))}>Test connection</button>
        <button className="btn primary" disabled={pending||!databaseUrl} onClick={()=>run(()=>initializeAivenAction({databaseUrl,caCert}))}>Initialize / upgrade schema</button>
      </div>
    </section>

    <section className="grid two">
      <div className="card stack">
        <div><h2>2. Application secrets</h2><div className="muted">Generate strong values, then store them as Vercel Secret environment variables.</div></div>
        <div className="field"><label>SESSION_SECRET</label><div className="secret-row"><input readOnly value={sessionSecret}/><button className="btn" onClick={()=>setSessionSecret(randomSecret(32))}>Regenerate</button></div></div>
        <div className="field"><label>CRON_SECRET</label><div className="secret-row"><input readOnly value={cronSecret}/><button className="btn" onClick={()=>setCronSecret(randomSecret(32))}>Regenerate</button></div></div>
      </div>

      <div className="card stack">
        <div><h2>3. Administrator bootstrap</h2><div className="muted">Create the first administrator or rotate its password directly in the selected Aiven database.</div></div>
        <div className="field"><label>Administrator name</label><input value={adminName} onChange={e=>setAdminName(e.target.value)}/></div>
        <div className="field"><label>Administrator email</label><input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)}/></div>
        <div className="field"><label>Administrator password</label><input type="password" minLength={12} value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="12+ characters"/></div>
        <button className="btn primary" disabled={pending||!databaseUrl||!adminEmail||adminPassword.length<12} onClick={()=>run(()=>bootstrapAdminAction({databaseUrl,caCert,email:adminEmail,password:adminPassword,name:adminName}))}>Create / rotate administrator</button>
      </div>
    </section>

    <section className="card stack">
      <div><h2>4. Vercel environment bundle</h2><div className="muted">Copy this into Vercel Project Settings → Environment Variables. Use Secret type for every value here. Redeploy after changing environment variables.</div></div>
      <textarea className="env-preview" readOnly value={envBundle} placeholder="Complete the fields above to generate the environment bundle."/>
      <div className="actions">
        <button className="btn primary" disabled={!envBundle} onClick={()=>copy(envBundle)}>Copy environment bundle</button>
        <button className="btn" onClick={()=>{setAdminPassword(randomSecret(18));setSessionSecret(randomSecret(32));setCronSecret(randomSecret(32));}}>Generate all secrets</button>
      </div>
    </section>

    <section className="card stack">
      <div><h2>5. Launch checklist</h2><div className="muted">The panel prepares and verifies infrastructure; Vercel environment changes take effect on a new deployment.</div></div>
      <div className="checklist">
        <div><span>1</span>Test the Aiven connection.</div>
        <div><span>2</span>Initialize PostGIS and CARE-Map tables.</div>
        <div><span>3</span>Create or rotate the administrator.</div>
        <div><span>4</span>Copy the environment bundle into Vercel as Secret variables.</div>
        <div><span>5</span>Redeploy CARE-Map and return here to verify green status.</div>
      </div>
    </section>

    {result&&<div className={result.ok?"success":"error"}><strong>{result.message}</strong>{result.details&&<div className="infra-details">{Object.entries(result.details).map(([k,v])=><span key={k}>{k}: {String(v??"")}</span>)}</div>}</div>}
  </div>;
}
