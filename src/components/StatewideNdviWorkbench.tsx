"use client";
import {useEffect,useRef,useState} from "react";
import {comparisonWindowError} from "@/lib/sentinel-date-quality";
import StatewideNdviMap from "@/components/StatewideNdviMap";
type StateJob={
 id:string;state_name:string;status:string;baseline_date:string;comparison_date:string;
 total_tiles:number;completed_tiles:number;needs_review_tiles:number;failed_tiles:number;
 quota_blocked_tiles:number;
 pending_tiles:number;coveragePercent:number;estimatedChangeHa:number|null;
 estimatedChangePct:number|null;resultsComplete:boolean;expected_lgas:number;
};
type LgaSummary={
 code:string;name:string;total_tiles:number;completed_tiles:number;
 needs_review_tiles:number;failed_tiles:number;coveragePercent:number;
 complete:boolean;changeHa:number|null;changePct:number|null;
};
export default function StatewideNdviWorkbench(){
 const [loaded,setLoaded]=useState(false);
 const [admin,setAdmin]=useState(false);
 const [readiness,setReadiness]=useState<any>(null);
 const [jobs,setJobs]=useState<StateJob[]>([]);
 const [selected,setSelected]=useState<string>("");
 const [detail,setDetail]=useState<{job:StateJob;lgas:LgaSummary[]}|null>(null);
 const [form,setForm]=useState({baselineDate:"2025-01-15",comparisonDate:"2026-01-15",windowDays:14,threshold:0.3});
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [running,setRunning]=useState(false);
 const keepRunning=useRef(false);
 const format=(v:number|null|undefined,d=1)=>v==null||!Number.isFinite(Number(v))?"—":
   Number(v).toLocaleString("en-NG",{maximumFractionDigits:d});
 async function refresh(id=selected){
  try{
   const r=await fetch("/api/remote-sensing/statewide",{cache:"no-store"});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"State-wide database tables are not ready.");
   setJobs(j.data.jobs||[]);setReadiness(j.data.readiness);setAdmin(Boolean(j.admin));
   const jobId=id||j.data.jobs?.[0]?.id;
   if(jobId){
    if(!selected)setSelected(jobId);
    const d=await fetch("/api/remote-sensing/statewide/"+jobId,{cache:"no-store"});
    const dj=await d.json().catch(()=>({}));
    if(d.ok)setDetail(dj.data);
   }
   setLoaded(true);
  }catch(e){setLoaded(true);setMessage(e instanceof Error?e.message:"State-wide status unavailable.");}
 }
 useEffect(()=>{
  void refresh();
  return()=>{keepRunning.current=false;};
 },[]);
 async function create(){
  const issue=comparisonWindowError(form.baselineDate,form.comparisonDate,form.windowDays);
  if(issue){setMessage(issue);return;}
  if(!confirm("Create a state-wide Sentinel job? Processing all imported LGA boundaries may require hundreds of separate Copernicus requests, time and provider quota. No results will be published automatically."))return;
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/remote-sensing/statewide",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)
   });
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"Could not create the state-wide job.");
   const id=j.data.id as string;
   setSelected(id);await refresh(id);
   setMessage("State-wide job planned in "+j.data.totalTiles+" geographically clipped tiles across "+j.data.lgas+" LGAs. Use Process tiles to start. Your job is saved and can be resumed.");
  }catch(e){setMessage(e instanceof Error?e.message:"Could not prepare state-wide analysis.");}
  finally{setBusy(false);}
 }
 async function retryQuotaTiles(){
  if(!selected||busy||running)return;
  if(!confirm("Have you checked the Copernicus account and confirmed enough request/processing quota is available? This will requeue only rate-limited tiles and will NOT immediately process them."))return;
  setBusy(true);setMessage("");
  try{
    const r=await fetch("/api/remote-sensing/statewide/"+selected+"/resume",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({providerQuotaConfirmed:true})
    });
    const json=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(json.error?.message||"Unable to requeue rate-limited tiles.");
    setMessage(json.data.requeued+" provider-limited tile(s) queued for a controlled retry. Existing passing tiles and cloud-review cases were preserved. Process a small batch to confirm quota is available.");
    await refresh(selected);
  }catch(e){
    setMessage(e instanceof Error?e.message:"Quota recovery unavailable.");
  }finally{setBusy(false);}
 }
 async function process(){
  if(!selected||running)return;
  keepRunning.current=true;setRunning(true);
  const maxPerSession=8;
  setMessage("Processing a safety-limited batch of up to "+maxPerSession+" tiles. Provider rate limits will stop the batch immediately.");
  try{
   let processed=0;
   for(let n=1;n<=maxPerSession&&keepRunning.current;n++){
    const r=await fetch("/api/remote-sensing/statewide/"+selected+"/advance",{method:"POST"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error?.message||"Satellite tile processing failed.");
    if(j.data?.providerBlocked){
      setMessage("STOPPED: Copernicus has reached its request or processing limit. No more tiles will be submitted. Review the Copernicus account quota before using the recovery action.");
      break;
    }
    if(!j.data?.processed){
      setMessage("No eligible queued tiles remain. Check the LGA quality summary; cloud-obscured tiles require a separate scientific review.");
      break;
    }
    processed++;
    if(n%2===0)await refresh(selected);
    if(n<maxPerSession&&keepRunning.current){
      // Gentle pacing is only a courtesy. It does not bypass a provider
      // subscription's hard monthly/daily processing-unit limit.
      await new Promise(resolve=>setTimeout(resolve,12000));
    }
   }
   if(processed>=maxPerSession&&keepRunning.current)
     setMessage("Safety batch finished ("+processed+" tiles). Progress is saved. Check provider usage before another batch.");
  }catch(e){
   setMessage("Processing stopped: "+(e instanceof Error?e.message:"Provider unavailable.")+
     ". Progress is retained; check your Copernicus account and retry only when appropriate.");
  }finally{keepRunning.current=false;setRunning(false);await refresh(selected);}
 }

 const job=detail?.job||jobs.find(x=>x.id===selected);
 const pending=job?Number(job.pending_tiles||0):0;
 const done=job?Number(job.completed_tiles||0):0;
 const total=job?Number(job.total_tiles||0):0;
 const percent=total?100*done/total:0;
 return <section className="card stack" aria-labelledby="statewide-ndvi-heading">
  <div className="section-head">
    <div><span className="page-eyebrow">State-scale GIS · Resumable Sentinel-2</span>
      <h2 id="statewide-ndvi-heading">State-wide vegetation change</h2>
      <p className="muted">Compare two seasons across every imported LGA. The application clips the geography into smaller satellite-processing tiles and checks each one individually.</p>
    </div>
    <span className="badge">Full-state workflow</span>
  </div>
  {!loaded&&<div className="notice" role="status">Checking LGA coverage and state-wide processing tables…</div>}
  {readiness&&<div className="resource-facts">
    <div><span>Mapped LGA boundaries</span><strong>{readiness.mappedLgas} / {readiness.totalLgas}</strong></div>
    <div><span>Imported geographic coverage</span><strong>{format(readiness.boundaryAreaHa,0)} ha</strong></div>
    <div><span>Boundary overlap</span><strong>{format(100*readiness.overlapFraction,2)}%</strong></div>
  </div>}
  <p className="muted">A state-wide figure is released only if every tile passes quality review. Incomplete coverage, cloud-obscured areas and provider failures are not silently estimated as zero change. Source boundaries require independent approval.</p>
  {admin&&<div className="stack">
    <div className="grid four">
      <div className="field"><label htmlFor="state-base">Baseline date</label><input id="state-base" type="date" value={form.baselineDate} onChange={e=>setForm(v=>({...v,baselineDate:e.target.value}))}/></div>
      <div className="field"><label htmlFor="state-comp">Comparison date</label><input id="state-comp" type="date" value={form.comparisonDate} onChange={e=>setForm(v=>({...v,comparisonDate:e.target.value}))}/></div>
      <div className="field"><label htmlFor="state-days">Days per window</label><select id="state-days" value={form.windowDays} onChange={e=>setForm(v=>({...v,windowDays:Number(e.target.value)}))}>{[7,10,14,21,30].map(d=><option key={d} value={d}>{d} days</option>)}</select></div>
      <div className="field"><label htmlFor="state-threshold">NDVI threshold</label><select id="state-threshold" value={form.threshold} onChange={e=>setForm(v=>({...v,threshold:Number(e.target.value)}))}>{[0.2,0.3,0.4,0.5].map(t=><option key={t} value={t}>NDVI ≥ {t.toFixed(2)}</option>)}</select></div>
    </div>
    <div className="actions"><button type="button" className="btn primary" disabled={busy||running||jobs.some(j=>["queued","running"].includes(j.status))} onClick={()=>void create()}>
      {busy?"Preparing tile plan…":"Create state-wide analysis"}
    </button>
      {jobs.some(j=>["queued","running"].includes(j.status))&&<span className="muted">Finish the active job before creating another.</span>}
    </div>
  </div>}
  {jobs.length>0&&<div className="field">
    <label htmlFor="state-job">Existing state-wide analysis</label>
    <select id="state-job" value={selected} onChange={e=>{setSelected(e.target.value);void refresh(e.target.value);}}>
      {jobs.map(j=><option key={j.id} value={j.id}>{j.state_name} · {String(j.baseline_date).slice(0,10)} → {String(j.comparison_date).slice(0,10)} · {j.status.replaceAll("_"," ")}</option>)}
    </select>
  </div>}
  {job&&<div className="stack">
    <div className="section-head"><strong>State-wide job progress</strong><span className="badge">{job.status.replaceAll("_"," ")}</span></div>
    <div className="resource-facts">
      <div><span>Quality-passing tiles</span><strong>{done} / {total}</strong></div>
      <div><span>Pending</span><strong>{pending}</strong></div>
      <div><span>Needs review</span><strong>{job.needs_review_tiles}</strong></div>
      <div><span>Failed</span><strong>{job.failed_tiles}</strong></div>
      <div><span>Provider rate-limited</span><strong>{job.quota_blocked_tiles||0}</strong></div>
    </div>
    <div className="statewide-progress" role="progressbar" aria-label="Passed Sentinel tile coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div style={{width:Math.max(0,Math.min(100,percent))+"%"}}/>
    </div>
    <div className="muted">{format(job.coveragePercent)}% of imported area has passed satellite quality checks.</div>
    <div className="resource-facts">
      <div><span>State vegetation change</span><strong>{job.resultsComplete?(Number(job.estimatedChangeHa)>0?"+":"")+format(job.estimatedChangeHa)+" ha":"Incomplete — no state estimate"}</strong></div>
      <div><span>Change from baseline</span><strong>{job.resultsComplete?format(job.estimatedChangePct)+"%":"Not yet established"}</strong></div>
    </div>
    {Number(job.quota_blocked_tiles||0)>0&&<div className="notice" role="alert">
      <strong>Copernicus provider limit reached.</strong> {job.quota_blocked_tiles} tile(s) failed because processing requests exceeded the provider quota.
      This is not a vegetation-loss result. No additional imagery processing should be started until the provider account limits are checked.
      {admin&&job.status==="needs_review"&&<div className="actions">
        <button type="button" className="btn" disabled={busy||running} onClick={()=>void retryQuotaTiles()}>
          Requeue rate-limited tiles after quota review
        </button>
      </div>}
    </div>}
    {admin&&job.status!=="completed"&&job.status!=="needs_review"&&<div className="actions">
      {!running?<button className="btn primary" type="button" onClick={()=>void process()}>Process next 8 tiles</button>
        :<button className="btn danger" type="button" onClick={()=>{keepRunning.current=false;setMessage("Stopping after the current tile request finishes. Saved work will be retained.");}}>Stop after current tile</button>}
      <button type="button" className="btn" onClick={()=>void refresh(selected)} disabled={running}>Refresh progress</button>
    </div>}
    {!!detail?.lgas?.length&&<StatewideNdviMap lgas={detail.lgas}/>}
    {!!detail?.lgas?.length&&<div className="table-wrap"><table>
      <thead><tr><th>LGA</th><th>Valid tiles</th><th>Area covered</th><th>Vegetation change</th><th>Change %</th><th>Review / failed</th></tr></thead>
      <tbody>{detail.lgas.map(l=><tr key={l.code}>
        <td><strong>{l.name}</strong></td>
        <td>{l.completed_tiles} / {l.total_tiles}</td>
        <td>{format(l.coveragePercent)}%</td>
        <td>{l.complete?(Number(l.changeHa)>0?"+":"")+format(l.changeHa)+" ha":"Incomplete"}</td>
        <td>{l.complete?format(l.changePct)+"%":"—"}</td>
        <td>{l.needs_review_tiles} / {l.failed_tiles}</td>
      </tr>)}</tbody></table></div>}
  </div>}
  {message&&<div className="notice" role="status">{message}</div>}
  {message.toLowerCase().includes("migration")&&
    <p className="muted">An administrator can apply pending database migrations using the existing <a href="/staff/extension">Staff Extension database setup</a> panel after confirming backup and change approval. No separate login is required if the administrator is already signed in.</p>}
  <p className="muted">Processing is resumable in paced batches of at most eight tiles. Keep this page open during a batch. Each tile consumes real Copernicus requests; check daily/monthly processing-unit and request quotas. No state-wide or LGA result is automatically published to the public map. A programme reviewer must approve results and geographic sources before external reporting.</p>
 </section>;
}
