/* eslint-disable @next/next/no-img-element */
"use client";
import {useEffect,useState} from "react";

export default function RemoteSensingResultDrawer({analysis,onClose,onUpdated}:{analysis:any;onClose:()=>void;onUpdated:()=>void}){
  const[detail,setDetail]=useState<any>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[nonce,setNonce]=useState(0);

  async function load(){
    const r=await fetch("/api/remote-sensing/analyses/"+analysis.id);
    const j=await r.json().catch(()=>({}));
    if(r.ok)setDetail(j.data);
  }
  useEffect(()=>{load();},[analysis.id]);

  async function run(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/analyses/"+analysis.id+"/run",{method:"POST"});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"NDVI analysis failed.");
    setMessage("NDVI comparison completed.");
    setNonce(x=>x+1);await load();onUpdated();
  }

  async function publish(value:boolean){
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/analyses/"+analysis.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({publishToMap:value})});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not update map visibility.");
    setMessage(value?"Published to the public CARE-Map.":"Removed from the public CARE-Map.");
    await load();onUpdated();
  }

  const d=detail||analysis;
  const fmt=(v:any,n=2)=>v==null?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:n});
  const pct=(v:any)=>v==null?"—":fmt(Number(v)*100,1)+"%";

  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <aside className="resource-drawer remote-drawer">
      <div className="section-head"><div><h2>{d.name}</h2><div className="muted">Sentinel-2 L2A · NDVI change analysis</div></div><button className="btn" onClick={onClose}>Close</button></div>

      <div className="stack">
        <section className="drawer-section stack">
          <div className="section-head"><h3>Analysis status</h3><span className={"priority-badge priority-"+(d.status==="failed"?"critical":d.status==="completed"?"low":"medium")}>{d.status?.replaceAll("_"," ")}</span></div>
          <div className="resource-facts">
            <div><span>AOI area</span><strong>{fmt(d.aoi_area_ha,1)} ha</strong></div>
            <div><span>Baseline</span><strong>{String(d.baseline_date)} + {d.window_days} days</strong></div>
            <div><span>Comparison</span><strong>{String(d.comparison_date)} + {d.window_days} days</strong></div>
            <div><span>Vegetation threshold</span><strong>NDVI ≥ {fmt(d.vegetation_threshold,2)}</strong></div>
          </div>
          {d.status!=="running"&&<button className="btn primary" disabled={busy} onClick={run}>{d.status==="completed"?"Re-run analysis":"Run NDVI analysis"}</button>}
          {d.error_message&&<div className="error">{d.error_message}</div>}
        </section>

        {d.status==="completed"&&<>
          <section className="drawer-section stack">
            <h3>Vegetation change</h3>
            <div className="stats">
              <div className="stat"><strong>{fmt(d.baseline_mean_ndvi,3)}</strong><span>Baseline mean NDVI</span></div>
              <div className="stat"><strong>{fmt(d.comparison_mean_ndvi,3)}</strong><span>Comparison mean NDVI</span></div>
              <div className="stat"><strong>{fmt(d.vegetation_change_ha,1)} ha</strong><span>Vegetation change</span></div>
              <div className="stat"><strong>{fmt(d.vegetation_change_pct,1)}%</strong><span>Change from baseline</span></div>
            </div>
            <div className="resource-facts">
              <div><span>Baseline vegetated area</span><strong>{fmt(d.baseline_vegetation_ha,1)} ha</strong></div>
              <div><span>Comparison vegetated area</span><strong>{fmt(d.comparison_vegetation_ha,1)} ha</strong></div>
              <div><span>Baseline clear-pixel coverage</span><strong>{pct(d.baseline_clear_fraction)}</strong></div>
              <div><span>Comparison clear-pixel coverage</span><strong>{pct(d.comparison_clear_fraction)}</strong></div>
              <div><span>Change level</span><strong>{d.change_level}</strong></div>
            </div>
            <div className="notice">Vegetation area is estimated from clear Sentinel-2 pixels at 10 m sampling. Cloud-masked pixels are excluded rather than guessed.</div>
          </section>

          <section className="drawer-section stack">
            <h3>NDVI previews</h3>
            <div className="ndvi-preview-grid">
              <figure><img src={"/api/remote-sensing/analyses/"+d.id+"/preview?period=baseline&v="+nonce} alt="Baseline NDVI preview"/><figcaption>Baseline · {String(d.baseline_date)}</figcaption></figure>
              <figure><img src={"/api/remote-sensing/analyses/"+d.id+"/preview?period=comparison&v="+nonce} alt="Comparison NDVI preview"/><figcaption>Comparison · {String(d.comparison_date)}</figcaption></figure>
            </div>
            <div className="ndvi-legend"><span className="ndvi-water">Low / water</span><span className="ndvi-sparse">Sparse</span><span className="ndvi-mid">Moderate</span><span className="ndvi-high">Dense vegetation</span></div>
          </section>

          <section className="drawer-section stack">
            <h3>CARE-Map layer</h3>
            <div className="notice">Publishing adds the AOI and its vegetation-change severity to the public interactive map. Raw provider statistics remain staff-only.</div>
            <button className={d.publish_to_map?"btn danger":"btn primary"} disabled={busy} onClick={()=>publish(!d.publish_to_map)}>{d.publish_to_map?"Remove from public map":"Publish vegetation-change layer"}</button>
          </section>
        </>}

        {message&&<div className={message.includes("failed")||message.includes("Could not")?"error":"notice"}>{message}</div>}
      </div>
    </aside>
  </div>;
}
