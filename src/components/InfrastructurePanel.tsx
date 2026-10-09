"use client";
import {useMemo,useState,useTransition} from "react";
import {bootstrapAdminAction,initializeAivenAction,testAivenAction,type InfraActionResult} from "@/app/staff/infrastructure/actions";

type ReadinessState="ready"|"warning"|"blocked";
type ReadinessItem={
  id:string;
  label:string;
  category:"infrastructure"|"security"|"database"|"data"|"operations";
  state:ReadinessState;
  required:boolean;
  detail:string;
  action:string;
};

type Snapshot={
  environment:string;
  databaseConfigured:boolean;
  caConfigured:boolean;
  sessionSecretConfigured:boolean;
  cronSecretConfigured:boolean;
  cloudinaryConfigured:boolean;
  remoteSensingConfigured:boolean;
  adminSeedConfigured:boolean;
  databaseHost:string|null;
  databaseName:string|null;
  database:{ok:boolean;postgresVersion?:string;postgisEnabled?:boolean;postgisVersion?:string|null;tables?:number;error?:string};
  migrations:{historyAvailable:boolean;expected:number;applied:number;pending:string[];checksumMismatches:string[];latestAppliedAt:string|null};
  data:{lgaBoundaries:number;totalLgas:number;pilotBoundaries:number;pilotLgas:number;verifiedRivers:number;verifiedSettlements:number;boreholes:number;assets:number;verifiedHazardZones:number;verifiedCatchments:number;pilotAcceptanceTested:number;pilotAcceptancePassed:number;admins:number};
  readinessItems:ReadinessItem[];
  readiness:{score:number;required:number;ready:number;warnings:number;blockers:number;optionalReady:number;optionalTotal:number};
};

function randomSecret(bytes=32){
  const a=new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
}

function Status({ok,label}:{ok:boolean;label:string}){
  return <div className={"setup-status "+(ok?"ok":"missing")}><span>{ok?"✓":"!"}</span><div><strong>{label}</strong><small>{ok?"Ready":"Needs configuration"}</small></div></div>;
}

function Gate({item}:{item:ReadinessItem}){
  const mark=item.state==="ready"?"✓":item.state==="warning"?"!":"×";
  return <div className={"readiness-gate "+item.state}>
    <div className="readiness-gate-mark">{mark}</div>
    <div className="readiness-gate-copy">
      <div className="readiness-gate-title"><strong>{item.label}</strong><span>{item.required?"Launch gate":"Optional capability"}</span></div>
      <p>{item.detail}</p>
      {item.state!=="ready"&&<small><strong>Next:</strong> {item.action}</small>}
    </div>
  </div>;
}

function escapeEnv(value:string){
  return value.replaceAll('"','\\\"');
}

export default function InfrastructurePanel({snapshot}:{snapshot:Snapshot}){
  const[databaseUrl,setDatabaseUrl]=useState("");
  const[caCert,setCaCert]=useState("");
  const[sessionSecret,setSessionSecret]=useState(()=>randomSecret(32));
  const[cronSecret,setCronSecret]=useState(()=>randomSecret(32));
  const[cloudinaryCloudName,setCloudinaryCloudName]=useState("");
  const[cloudinaryApiKey,setCloudinaryApiKey]=useState("");
  const[cloudinaryApiSecret,setCloudinaryApiSecret]=useState("");
  const[cdseClientId,setCdseClientId]=useState("");
  const[cdseClientSecret,setCdseClientSecret]=useState("");
  const[dataControllerName,setDataControllerName]=useState("");
  const[dataControllerAddress,setDataControllerAddress]=useState("");
  const[privacyContactEmail,setPrivacyContactEmail]=useState("");
  const[privacyReportsBasis,setPrivacyReportsBasis]=useState("");
  const[privacyAccountsBasis,setPrivacyAccountsBasis]=useState("");
  const[privacyLegalReviewedAt,setPrivacyLegalReviewedAt]=useState("");
  const[privacyReviewer,setPrivacyReviewer]=useState("");
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
    if(cloudinaryCloudName)lines.push('CLOUDINARY_CLOUD_NAME="'+escapeEnv(cloudinaryCloudName)+'"');
    if(cloudinaryApiKey)lines.push('CLOUDINARY_API_KEY="'+escapeEnv(cloudinaryApiKey)+'"');
    if(cloudinaryApiSecret)lines.push('CLOUDINARY_API_SECRET="'+escapeEnv(cloudinaryApiSecret)+'"');
    if(cdseClientId)lines.push('CDSE_CLIENT_ID="'+escapeEnv(cdseClientId)+'"');
    if(cdseClientSecret)lines.push('CDSE_CLIENT_SECRET="'+escapeEnv(cdseClientSecret)+'"');
    if(dataControllerName)lines.push('DATA_CONTROLLER_NAME="'+escapeEnv(dataControllerName)+'"');
    if(dataControllerAddress)lines.push('DATA_CONTROLLER_ADDRESS="'+escapeEnv(dataControllerAddress)+'"');
    if(privacyContactEmail)lines.push('PRIVACY_CONTACT_EMAIL="'+escapeEnv(privacyContactEmail)+'"');
    if(privacyReportsBasis)lines.push('PRIVACY_LAWFUL_BASIS_REPORTS="'+escapeEnv(privacyReportsBasis)+'"');
    if(privacyAccountsBasis)lines.push('PRIVACY_LAWFUL_BASIS_ACCOUNTS="'+escapeEnv(privacyAccountsBasis)+'"');
    if(privacyLegalReviewedAt)lines.push('PRIVACY_LEGAL_REVIEWED_AT="'+escapeEnv(privacyLegalReviewedAt)+'"');
    if(privacyReviewer)lines.push('PRIVACY_REVIEWER="'+escapeEnv(privacyReviewer)+'"');
    if(adminEmail)lines.push('ADMIN_EMAIL="'+escapeEnv(adminEmail)+'"');
    if(adminPassword)lines.push('ADMIN_PASSWORD="'+escapeEnv(adminPassword)+'"');
    return lines.join("\n");
  },[databaseUrl,caCert,sessionSecret,cronSecret,cloudinaryCloudName,cloudinaryApiKey,cloudinaryApiSecret,cdseClientId,cdseClientSecret,dataControllerName,dataControllerAddress,privacyContactEmail,privacyReportsBasis,privacyAccountsBasis,privacyLegalReviewedAt,privacyReviewer,adminEmail,adminPassword]);

  const required=snapshot.readinessItems.filter(x=>x.required);
  const optional=snapshot.readinessItems.filter(x=>!x.required);

  function run(fn:()=>Promise<InfraActionResult>){
    setResult(null);
    startTransition(()=>{void fn().then(setResult).catch(e=>setResult({ok:false,message:e instanceof Error?e.message:"Action failed."}));});
  }

  async function copy(text:string){
    await navigator.clipboard.writeText(text);
    setResult({ok:true,message:"Copied to clipboard."});
  }

  return <div className="stack">
    <section className="card stack readiness-overview">
      <div className="section-head">
        <div><h2>Production Readiness Center</h2><div className="muted">Live launch evidence from the deployed environment and configured database. Secret values are never displayed.</div></div>
        <div className="actions readiness-head-actions">
          <span className="badge">{snapshot.environment}</span>
          <button className="btn" onClick={()=>window.location.reload()}>Recheck readiness</button>
          <a className="btn" href="/api/admin/readiness" target="_blank" rel="noreferrer">View JSON</a>
        </div>
      </div>

      <div className="readiness-hero">
        <div className={"readiness-score "+(snapshot.readiness.blockers?"blocked":snapshot.readiness.warnings?"warning":"ready")}>
          <strong>{snapshot.readiness.score}%</strong>
          <span>launch readiness</span>
        </div>
        <div className="stats readiness-stats">
          <div className="stat"><strong>{snapshot.readiness.ready}/{snapshot.readiness.required}</strong><span>Required gates ready</span></div>
          <div className="stat"><strong>{snapshot.readiness.blockers}</strong><span>Blocking items</span></div>
          <div className="stat"><strong>{snapshot.migrations.applied}/{snapshot.migrations.expected}</strong><span>Migrations recorded</span></div>
          <div className="stat"><strong>{snapshot.data.pilotBoundaries}/{snapshot.data.pilotLgas}</strong><span>Pilot LGA boundaries</span></div>
          <div className="stat"><strong>{snapshot.data.boreholes+snapshot.data.assets}</strong><span>Mapped interventions</span></div>
          <div className="stat"><strong>{snapshot.data.pilotAcceptancePassed}/{snapshot.data.pilotLgas}</strong><span>Pilot LGAs field-accepted</span></div>
        </div>
      </div>

      <div className="readiness-meter" aria-label={"Readiness "+snapshot.readiness.score+" percent"}><span style={{width:snapshot.readiness.score+"%"}}/></div>

      {snapshot.migrations.checksumMismatches.length>0&&<div className="error">
        <strong>Migration integrity failure.</strong> Historical migration files changed after being recorded: {snapshot.migrations.checksumMismatches.join(", ")}. Restore those files and create a new migration for schema changes.
      </div>}

      <div className="readiness-columns">
        <div className="stack">
          <div className="section-head"><h3>Required launch gates</h3><span className="badge">{snapshot.readiness.blockers} blocked</span></div>
          <div className="readiness-gates">{required.map(item=><Gate key={item.id} item={item}/>)}</div>
        </div>
        <div className="stack">
          <div className="section-head"><h3>Advanced capability gates</h3><span className="badge">{snapshot.readiness.optionalReady}/{snapshot.readiness.optionalTotal} ready</span></div>
          <div className="readiness-gates">{optional.map(item=><Gate key={item.id} item={item}/>)}</div>
        </div>
      </div>
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Environment configuration</h2><div className="muted">Fast status view of secrets and external services.</div></div></div>
      <div className="setup-status-grid">
        <Status ok={snapshot.databaseConfigured&&snapshot.database.ok} label="Aiven database"/>
        <Status ok={snapshot.database.postgisEnabled===true} label="PostGIS"/>
        <Status ok={snapshot.caConfigured} label="Aiven CA certificate"/>
        <Status ok={snapshot.sessionSecretConfigured} label="Session signing secret"/>
        <Status ok={snapshot.cronSecretConfigured} label="Cron secret"/>
        <Status ok={snapshot.cloudinaryConfigured} label="Cloudinary photo storage"/>
        <Status ok={snapshot.remoteSensingConfigured} label="Copernicus remote sensing"/>
      </div>
      {snapshot.databaseConfigured&&<div className="notice">Configured database: <strong>{snapshot.databaseHost||"unknown host"}</strong> / {snapshot.databaseName||"unknown database"} · {snapshot.database.ok?"reachable":"unreachable"}{snapshot.database.postgisEnabled?" · PostGIS "+(snapshot.database.postgisVersion||""):""}</div>}
      {snapshot.migrations.pending.length>0&&<div className="notice"><strong>Pending migration files:</strong> {snapshot.migrations.pending.join(", ")}</div>}
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
      <div className="notice">Schema upgrades now use a migration ledger with SHA-256 checksums. Applied migration files are skipped; checksum drift blocks the upgrade so historical SQL cannot be silently rewritten.</div>
    </section>

    <section className="grid two">
      <div className="card stack">
        <div><h2>2. Application secrets</h2><div className="muted">Generate strong values, then store them as Vercel Secret environment variables.</div></div>
        <div className="field"><label>SESSION_SECRET</label><div className="secret-row"><input readOnly value={sessionSecret}/><button className="btn" onClick={()=>setSessionSecret(randomSecret(32))}>Regenerate</button></div></div>
        <div className="field"><label>CRON_SECRET</label><div className="secret-row"><input readOnly value={cronSecret}/><button className="btn" onClick={()=>setCronSecret(randomSecret(32))}>Regenerate</button></div></div>
        <div className="stack">
          <strong>Cloudinary photo storage</strong>
          <div className="muted">All image uploads use private server-side credentials. Copy these into Vercel Production environment variables and redeploy. Never prefix API secrets with NEXT_PUBLIC_.</div>
          <div className="field"><label>CLOUDINARY_CLOUD_NAME</label><input value={cloudinaryCloudName} onChange={e=>setCloudinaryCloudName(e.target.value)} placeholder="Cloudinary cloud name"/></div>
          <div className="field"><label>CLOUDINARY_API_KEY</label><input type="password" autoComplete="off" value={cloudinaryApiKey} onChange={e=>setCloudinaryApiKey(e.target.value)} placeholder="Cloudinary API key"/></div>
          <div className="field"><label>CLOUDINARY_API_SECRET</label><input type="password" autoComplete="off" value={cloudinaryApiSecret} onChange={e=>setCloudinaryApiSecret(e.target.value)} placeholder="Cloudinary API secret"/></div>
          <div className="notice">Uploaded image links use Cloudinary's public delivery URLs. Restrict uploads to redacted, non-sensitive field photos. Historical Vercel Blob image links remain unchanged.</div>
          <a href="https://console.cloudinary.com/" target="_blank" rel="noreferrer">Open Cloudinary dashboard ↗</a>
        </div>
      </div>

      <div className="card stack">
        <div><h2>3. Copernicus remote sensing</h2><div className="muted">Earth Search scene discovery works without credentials. These OAuth values enable Sentinel-2 NDVI statistics and preview processing through Copernicus Data Space.</div></div>
        <div className="field"><label>CDSE_CLIENT_ID</label><input type="password" autoComplete="off" value={cdseClientId} onChange={e=>setCdseClientId(e.target.value)} placeholder="Copernicus OAuth client ID"/></div>
        <div className="field"><label>CDSE_CLIENT_SECRET</label><input type="password" autoComplete="off" value={cdseClientSecret} onChange={e=>setCdseClientSecret(e.target.value)} placeholder="Copernicus OAuth client secret"/></div>
      </div>
    </section>

    <section className="card stack">
      <div><h2>4. Privacy & legal launch settings</h2><div className="muted">Enter the final wording only after the responsible privacy/legal reviewer has confirmed the controller identity and lawful bases.</div></div>
      <div className="grid two">
        <div className="field"><label>DATA_CONTROLLER_NAME</label><input value={dataControllerName} onChange={e=>setDataControllerName(e.target.value)} placeholder="Final legal identity of the CARE-Map controller"/></div>
        <div className="field"><label>PRIVACY_CONTACT_EMAIL</label><input type="email" value={privacyContactEmail} onChange={e=>setPrivacyContactEmail(e.target.value)} placeholder="privacy@example.gov.ng"/></div>
      </div>
      <div className="field"><label>DATA_CONTROLLER_ADDRESS</label><input value={dataControllerAddress} onChange={e=>setDataControllerAddress(e.target.value)} placeholder="Official address"/></div>
      <div className="grid two">
        <div className="field"><label>PRIVACY_LAWFUL_BASIS_REPORTS</label><textarea value={privacyReportsBasis} onChange={e=>setPrivacyReportsBasis(e.target.value)} placeholder="Legally reviewed basis for core community-report processing"/></div>
        <div className="field"><label>PRIVACY_LAWFUL_BASIS_ACCOUNTS</label><textarea value={privacyAccountsBasis} onChange={e=>setPrivacyAccountsBasis(e.target.value)} placeholder="Legally reviewed basis for community-account processing"/></div>
      </div>
      <div className="grid two">
        <div className="field"><label>PRIVACY_LEGAL_REVIEWED_AT</label><input type="date" value={privacyLegalReviewedAt} onChange={e=>setPrivacyLegalReviewedAt(e.target.value)}/></div>
        <div className="field"><label>PRIVACY_REVIEWER</label><input value={privacyReviewer} onChange={e=>setPrivacyReviewer(e.target.value)} placeholder="Reviewer / DPO / DPCO / legal function"/></div>
      </div>
      <div className="notice">Do not fill the review fields merely to turn the dashboard green. They are an attestation that the privacy notice, processing purposes, lawful bases, retention, processors/transfers, rights workflow, breach process and DPIA need have actually been reviewed.</div>
    </section>

    <section className="card stack">
      <div><h2>5. Administrator bootstrap</h2><div className="muted">Create the first administrator or rotate its password directly in the selected Aiven database.</div></div>
      <div className="grid two">
        <div className="field"><label>Administrator name</label><input value={adminName} onChange={e=>setAdminName(e.target.value)}/></div>
        <div className="field"><label>Administrator email</label><input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)}/></div>
      </div>
      <div className="field"><label>Administrator password</label><input type="password" minLength={12} value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="12+ characters"/></div>
      <button className="btn primary" disabled={pending||!databaseUrl||!adminEmail||adminPassword.length<12} onClick={()=>run(()=>bootstrapAdminAction({databaseUrl,caCert,email:adminEmail,password:adminPassword,name:adminName}))}>Create / rotate administrator</button>
    </section>

    <section className="card stack">
      <div><h2>6. Vercel environment bundle</h2><div className="muted">Copy this into Vercel Project Settings → Environment Variables. Keep credentials/secrets protected; controller identity, privacy contact and lawful-basis wording are intentionally public configuration. Redeploy after changing environment variables.</div></div>
      <textarea className="env-preview" readOnly value={envBundle} placeholder="Complete the fields above to generate the environment bundle."/>
      <div className="actions">
        <button className="btn primary" disabled={!envBundle} onClick={()=>copy(envBundle)}>Copy environment bundle</button>
        <button className="btn" onClick={()=>{setAdminPassword(randomSecret(18));setSessionSecret(randomSecret(32));setCronSecret(randomSecret(32));}}>Generate all secrets</button>
      </div>
    </section>

    <section className="card stack">
      <div><h2>7. Launch sequence</h2><div className="muted">Do these in order. The readiness score will change only after the server/database actually reflect the configuration.</div></div>
      <div className="checklist">
        <div><span>1</span>Configure and test the Aiven connection.</div>
        <div><span>2</span>Initialize or upgrade PostGIS and record every migration checksum.</div>
        <div><span>3</span>Create the administrator and configure SESSION_SECRET / CRON_SECRET.</div>
        <div><span>4</span>Import approved boundaries for every pilot LGA and baseline intervention coordinates.</div>
        <div><span>5</span>Complete privacy/legal review, configure the final controller/contact/lawful-basis settings, and apply migration 014.</div>
        <div><span>6</span>Configure photo storage and Copernicus credentials when those advanced workflows are required.</div>
        <div><span>7</span>Redeploy, recheck readiness, then complete field acceptance before public launch.</div>
      </div>
    </section>

    {result&&<div className={result.ok?"success":"error"}><strong>{result.message}</strong>{result.details&&<div className="infra-details">{Object.entries(result.details).map(([k,v])=><span key={k}>{k}: {String(v??"")}</span>)}</div>}</div>}
  </div>;
}
