"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type CheckStatus="not_run"|"pass"|"fail"|"blocked"|"not_applicable";
type Diagnostic={label:string;state:"ready"|"warning"|"blocked";detail:string};

function statusLabel(value:CheckStatus){
  return value==="not_run"?"Not run":value==="not_applicable"?"N/A":value.charAt(0).toUpperCase()+value.slice(1);
}

function resultClass(value:string){
  if(value==="pass")return "success";
  if(value==="fail")return "error";
  return "notice";
}

export default function FieldAcceptanceCenter(){
  const[runs,setRuns]=useState<any[]>([]);
  const[lgas,setLgas]=useState<any[]>([]);
  const[summary,setSummary]=useState<any|null>(null);
  const[selectedId,setSelectedId]=useState("");
  const[current,setCurrent]=useState<any|null>(null);
  const[checkNotes,setCheckNotes]=useState<Record<string,string>>({});
  const[lgaCode,setLgaCode]=useState("");
  const[deviceLabel,setDeviceLabel]=useState("");
  const[networkContext,setNetworkContext]=useState("");
  const[appVersion,setAppVersion]=useState("");
  const[newNotes,setNewNotes]=useState("");
  const[runNotes,setRunNotes]=useState("");
  const[diagnostics,setDiagnostics]=useState<Diagnostic[]>([]);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  const loadOverview=useCallback(async()=>{
    const r=await fetch("/api/field-acceptance");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Could not load field acceptance runs.");
    setRuns(j.data||[]);
    setLgas(j.lgas||[]);
    setSummary(j.summary||null);
  },[]);

  const loadRun=useCallback(async(id:string)=>{
    if(!id){setCurrent(null);return;}
    const r=await fetch("/api/field-acceptance/"+id);
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Could not load acceptance run.");
    setCurrent(j.data);
    setRunNotes(j.data.notes||"");
    setCheckNotes(Object.fromEntries((j.data.checks||[]).map((x:any)=>[x.check_key,x.notes||""])));
  },[]);

  useEffect(()=>{void loadOverview();},[loadOverview]);
  useEffect(()=>{if(selectedId)void loadRun(selectedId);},[selectedId,loadRun]);

  useEffect(()=>{
    if(!lgaCode&&lgas.length){
      const first=lgas.find(x=>x.pilot)||lgas[0];
      setLgaCode(first?.code||"");
    }
    if(!deviceLabel&&typeof navigator!=="undefined"){
      const mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
      setDeviceLabel(mobile?"Field phone":"Field device / laptop");
      setNetworkContext(navigator.onLine?"Online at session start":"Offline at session start");
    }
  },[lgas,lgaCode,deviceLabel]);

  function runPreflight(){
    const results:Diagnostic[]=[];
    results.push({
      label:"Secure context",
      state:window.isSecureContext?"ready":"blocked",
      detail:window.isSecureContext?"HTTPS/secure context available.":"GPS, camera and service workers may be restricted outside HTTPS."
    });
    results.push({
      label:"Network state",
      state:navigator.onLine?"ready":"warning",
      detail:navigator.onLine?"Browser reports online.":"Browser reports offline; useful for offline tests but online submission cannot run yet."
    });
    results.push({
      label:"Geolocation API",
      state:"geolocation" in navigator?"ready":"blocked",
      detail:"geolocation" in navigator?"Device exposes geolocation. Permission and field accuracy must still be tested.":"Geolocation API is unavailable."
    });
    const swSupported="serviceWorker" in navigator;
    results.push({
      label:"Service worker",
      state:!swSupported?"blocked":navigator.serviceWorker.controller?"ready":"warning",
      detail:!swSupported?"Service workers are unsupported.":navigator.serviceWorker.controller?"This page is controlled by a service worker.":"Supported, but this page is not currently controlled. Reload after the worker installs."
    });
    try{
      const key="caremap_acceptance_storage_test";
      localStorage.setItem(key,"ok");
      localStorage.removeItem(key);
      results.push({label:"Local storage queue",state:"ready",detail:"Browser local storage is writable for queued community reports."});
    }catch{
      results.push({label:"Local storage queue",state:"blocked",detail:"Local storage is unavailable; offline report queuing cannot be trusted."});
    }
    results.push({
      label:"Camera/media API",
      state:navigator.mediaDevices?.getUserMedia?"ready":"warning",
      detail:navigator.mediaDevices?.getUserMedia?"Camera/media APIs are exposed. Actual permission and photo upload still require a field test.":"Camera media API is not exposed in this browser."
    });
    setDiagnostics(results);
  }

  async function createRun(){
    if(!lgaCode||deviceLabel.trim().length<2)return setMessage("Choose an LGA and identify the test device.");
    setBusy(true);setMessage("");
    const r=await fetch("/api/field-acceptance",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        lgaCode,
        deviceLabel:deviceLabel.trim(),
        deviceInfo:navigator.userAgent,
        networkContext:networkContext.trim()||null,
        appVersion:appVersion.trim()||null,
        notes:newNotes.trim()||null
      })
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not create field test run.");
    setMessage("Field acceptance run created with "+j.data.checks+" checks.");
    setSelectedId(j.data.id);
    setNewNotes("");
    await loadOverview();
  }

  async function updateCheck(check:any,status:CheckStatus){
    const notes=checkNotes[check.check_key]||"";
    setBusy(true);setMessage("");
    const r=await fetch("/api/field-acceptance/"+current.id,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({checkKey:check.check_key,status,checkNotes:notes})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not update acceptance check.");
    setMessage(check.label+" → "+statusLabel(status)+".");
    await Promise.all([loadRun(current.id),loadOverview()]);
  }

  async function saveRunNotes(){
    if(!current)return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/field-acceptance/"+current.id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({notes:runNotes})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not save run notes.");
    setMessage("Run notes saved.");
    await loadRun(current.id);
  }

  async function completeRun(){
    if(!current)return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/field-acceptance/"+current.id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({complete:true})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not complete field acceptance run.");
    setMessage("Field acceptance completed: "+String(j.data.result).toUpperCase()+".");
    await Promise.all([loadRun(current.id),loadOverview()]);
  }

  async function reopenRun(){
    if(!current)return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/field-acceptance/"+current.id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({reopen:true})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not reopen field acceptance run.");
    setMessage("Acceptance run reopened.");
    await Promise.all([loadRun(current.id),loadOverview()]);
  }

  async function uploadEvidence(checkKey:string,file:File){
    if(!current)return;
    setBusy(true);setMessage("");
    const form=new FormData();
    form.set("file",file);
    form.set("checkKey",checkKey);
    form.set("caption","Field acceptance evidence · "+checkKey.replaceAll("_"," "));
    const r=await fetch("/api/field-acceptance/"+current.id+"/evidence",{method:"POST",body:form});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Evidence upload failed.");
    setMessage("Evidence image uploaded.");
    await loadRun(current.id);
  }

  const requiredChecks=current?.checks?.filter((x:any)=>x.required)||[];
  const requiredPassed=requiredChecks.filter((x:any)=>x.status==="pass").length;
  const requiredNotRun=requiredChecks.filter((x:any)=>x.status==="not_run").length;
  const failed=current?.checks?.filter((x:any)=>x.status==="fail").length||0;
  const blocked=current?.checks?.filter((x:any)=>x.status==="blocked").length||0;
  const grouped=useMemo(()=>{
    const groups:Record<string,any[]>={};
    for(const check of current?.checks||[])(groups[check.category]||=[]).push(check);
    return groups;
  },[current]);

  return <div className="stack">
    <section className="card stack">
      <div className="section-head">
        <div><h1>Field Acceptance Test Center</h1><div className="muted">Run and record real pilot-device tests for GPS, offline reporting, maps and staff workflows before launch.</div></div>
        <button className="btn" onClick={()=>{void loadOverview();if(current)void loadRun(current.id);}}>Refresh</button>
      </div>
      <div className="stats field-acceptance-stats">
        <div className="stat"><strong>{summary?.pilot_lgas_passed??"–"}/{summary?.pilot_lgas??"–"}</strong><span>Pilot LGAs passed</span></div>
        <div className="stat"><strong>{summary?.pilot_lgas_tested??"–"}</strong><span>Pilot LGAs tested</span></div>
        <div className="stat"><strong>{summary?.pilot_lgas_conditional??"–"}</strong><span>Latest conditional</span></div>
        <div className="stat"><strong>{summary?.pilot_lgas_failed??"–"}</strong><span>Latest failed</span></div>
        <div className="stat"><strong>{runs.length}</strong><span>Recent test runs</span></div>
      </div>
      <div className="notice"><strong>Acceptance rule:</strong> a run passes only when every required check passes. Failed required checks fail the run; blocked/N/A required checks produce a conditional result. Required checks cannot be left “not run” at completion.</div>
    </section>

    <section className="grid two field-acceptance-start-grid">
      <div className="card stack">
        <div><h2>Device preflight</h2><div className="muted">Quick browser diagnostics. These do not replace the real workflow checks below.</div></div>
        <button className="btn" onClick={runPreflight}>Run device preflight</button>
        {!!diagnostics.length&&<div className="readiness-gates">{diagnostics.map(d=><div className={"readiness-gate "+d.state} key={d.label}>
          <div className="readiness-gate-mark">{d.state==="ready"?"✓":d.state==="warning"?"!":"×"}</div>
          <div className="readiness-gate-copy"><div className="readiness-gate-title"><strong>{d.label}</strong></div><p>{d.detail}</p></div>
        </div>)}</div>}
      </div>

      <div className="card stack">
        <div><h2>Start field test run</h2><div className="muted">Create one run for the actual device and LGA being tested.</div></div>
        <div className="grid two">
          <div className="field"><label>LGA</label><select value={lgaCode} onChange={e=>setLgaCode(e.target.value)}>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}{x.pilot?" · Pilot":""}</option>)}</select></div>
          <div className="field"><label>Device label</label><input value={deviceLabel} onChange={e=>setDeviceLabel(e.target.value)} placeholder="e.g. Samsung A14 · GIS Unit"/></div>
        </div>
        <div className="grid two">
          <div className="field"><label>Network context</label><input value={networkContext} onChange={e=>setNetworkContext(e.target.value)} placeholder="e.g. MTN 4G / weak signal / mixed"/></div>
          <div className="field"><label>Build / deployment label</label><input value={appVersion} onChange={e=>setAppVersion(e.target.value)} placeholder="Optional commit/deployment label"/></div>
        </div>
        <div className="field"><label>Session notes</label><textarea value={newNotes} onChange={e=>setNewNotes(e.target.value)} placeholder="Weather, field site, device owner, known constraints…"/></div>
        <button className="btn primary" disabled={busy||!lgaCode||deviceLabel.trim().length<2} onClick={createRun}>{busy?"Working…":"Create acceptance run"}</button>
      </div>
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Recent runs</h2><div className="muted">The latest completed result per pilot LGA drives the production-readiness field gate.</div></div><span className="badge">{runs.length}</span></div>
      {runs.length?<div className="table-wrap"><table>
        <thead><tr><th>LGA</th><th>Device</th><th>Started</th><th>Required pass</th><th>Failed</th><th>Blocked</th><th>Result</th><th></th></tr></thead>
        <tbody>{runs.map(run=><tr key={run.id}>
          <td><strong>{run.lga_name}</strong>{run.pilot&&<span className="badge" style={{marginLeft:6}}>Pilot</span>}</td>
          <td>{run.device_label}<div className="muted">{run.network_context||"—"}</div></td>
          <td>{new Date(run.started_at).toLocaleString()}</td>
          <td>{run.required_passed}/{run.required_checks}</td>
          <td className={Number(run.failed_checks)>0?"overdue-text":""}>{run.failed_checks}</td>
          <td>{run.blocked_checks}</td>
          <td><span className={"acceptance-result "+run.result}>{run.result}</span></td>
          <td><button className="btn" onClick={()=>setSelectedId(run.id)}>Open</button></td>
        </tr>)}</tbody>
      </table></div>:<div className="notice">No field acceptance runs yet.</div>}
    </section>

    {current&&<section className="card stack field-acceptance-run">
      <div className="section-head">
        <div><h2>{current.lga_name} · {current.device_label}</h2><div className="muted">{current.status} · started {new Date(current.started_at).toLocaleString()} · by {current.created_by_name||"staff"}</div></div>
        <span className={"acceptance-result "+current.result}>{current.result}</span>
      </div>

      <div className="stats">
        <div className="stat"><strong>{requiredPassed}/{requiredChecks.length}</strong><span>Required passed</span></div>
        <div className="stat"><strong>{requiredNotRun}</strong><span>Required not run</span></div>
        <div className="stat"><strong>{failed}</strong><span>Failed checks</span></div>
        <div className="stat"><strong>{blocked}</strong><span>Blocked checks</span></div>
        <div className="stat"><strong>{current.evidence?.length||0}</strong><span>Evidence images</span></div>
      </div>

      {Object.entries(grouped).map(([category,checks])=><div className="stack acceptance-category" key={category}>
        <div className="section-head"><h3>{category.replaceAll("_"," ")}</h3><span className="badge">{checks.length}</span></div>
        <div className="acceptance-check-list">{checks.map((check:any)=><article className={"acceptance-check "+check.status} key={check.check_key}>
          <div className="acceptance-check-head">
            <div><strong>{check.label}</strong><div className="muted">{check.required?"Required":"Optional"} · {statusLabel(check.status)}</div></div>
            <span className={"acceptance-check-status "+check.status}>{statusLabel(check.status)}</span>
          </div>
          <p>{check.instructions}</p>
          <div className="acceptance-status-buttons">
            {(["pass","fail","blocked","not_applicable"] as CheckStatus[]).map(status=><button
              key={status}
              className={"btn "+(check.status===status?"primary":"")}
              disabled={busy||current.status==="completed"}
              onClick={()=>updateCheck(check,status)}
            >{statusLabel(status)}</button>)}
            {check.status!=="not_run"&&<button className="btn" disabled={busy||current.status==="completed"} onClick={()=>updateCheck(check,"not_run")}>Reset</button>}
          </div>
          <div className="field"><label>Check notes</label><textarea value={checkNotes[check.check_key]||""} onChange={e=>setCheckNotes(x=>({...x,[check.check_key]:e.target.value}))} placeholder="Observed result, reference ID, accuracy, failure details…"/></div>
          <div className="acceptance-check-footer">
            <button className="btn" disabled={busy||current.status==="completed"} onClick={()=>updateCheck(check,check.status as CheckStatus)}>Save note</button>
            <label className="btn acceptance-upload">Add evidence image<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void uploadEvidence(check.check_key,file);e.currentTarget.value="";}}/></label>
            {Number(check.evidence_count)>0&&<span className="badge">{check.evidence_count} evidence</span>}
            {check.tested_by_name&&<span className="muted">Tested by {check.tested_by_name}{check.tested_at?" · "+new Date(check.tested_at).toLocaleString():""}</span>}
          </div>
        </article>)}</div>
      </div>)}

      <div className="field"><label>Overall run notes</label><textarea value={runNotes} onChange={e=>setRunNotes(e.target.value)} placeholder="Overall observations, issues to retest, field conditions…"/></div>
      <div className="actions">
        <button className="btn" disabled={busy} onClick={saveRunNotes}>Save run notes</button>
        {current.status==="in_progress"
          ?<button className="btn primary" disabled={busy||requiredNotRun>0} onClick={completeRun}>Complete acceptance run</button>
          :<button className="btn" disabled={busy} onClick={reopenRun}>Reopen run</button>}
      </div>

      {!!current.evidence?.length&&<div className="stack">
        <div className="section-head"><h3>Evidence</h3><span className="badge">{current.evidence.length}</span></div>
        <div className="acceptance-evidence-grid">{current.evidence.map((e:any)=><a className="acceptance-evidence-card" href={e.url} target="_blank" rel="noreferrer" key={e.id}>
          <strong>{e.check_key?.replaceAll("_"," ")||"General evidence"}</strong>
          <span>{e.caption||"Open image"}</span>
          <small>{new Date(e.uploaded_at).toLocaleString()} · {e.uploaded_by_name||"staff"}</small>
        </a>)}</div>
      </div>}

      {current.status==="completed"&&<div className={resultClass(current.result)}><strong>Final result: {String(current.result).toUpperCase()}</strong>{current.result==="conditional"&&<div>At least one required check was blocked or marked not applicable. Resolve the constraint and rerun before treating this LGA/device combination as fully accepted.</div>}</div>}
    </section>}

    {message&&<div className={message.includes("completed: PASS")?"success":"notice"}>{message}</div>}
  </div>;
}
