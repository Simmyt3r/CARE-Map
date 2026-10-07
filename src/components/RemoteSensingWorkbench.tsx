"use client";
import {useEffect,useState} from "react";
import RemoteSensingResultDrawer from "@/components/RemoteSensingResultDrawer";

const polygonExample='{"type":"Polygon","coordinates":[[[8.50,7.70],[8.55,7.70],[8.55,7.75],[8.50,7.75],[8.50,7.70]]]}';

export default function RemoteSensingWorkbench(){
  const[analyses,setAnalyses]=useState<any[]>([]);
  const[forests,setForests]=useState<any[]>([]);
  const[configured,setConfigured]=useState(false);
  const[selected,setSelected]=useState<any|null>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[sceneResults,setSceneResults]=useState<{baseline:any[];comparison:any[]}>({baseline:[],comparison:[]});
  const[form,setForm]=useState({name:"",forestId:"",geometry:"",baselineDate:"",comparisonDate:"",windowDays:"7",threshold:"0.30"});

  async function load(){
    const [a,f]=await Promise.all([fetch("/api/remote-sensing/analyses"),fetch("/api/resources/forest-sites")]);
    const aj=await a.json().catch(()=>({})),fj=await f.json().catch(()=>({}));
    if(a.ok){setAnalyses(aj.data||[]);setConfigured(Boolean(aj.configured));}
    if(f.ok)setForests(fj.data||[]);
  }
  useEffect(()=>{load();},[]);

  function chooseForest(id:string){
    setForm(x=>({...x,forestId:id}));
    const forest=forests.find(f=>f.id===id);
    if(forest?.geometry)setForm(x=>({...x,forestId:id,geometry:JSON.stringify(forest.geometry),name:x.name||forest.name+" vegetation change"}));
  }

  function parsedGeometry(){
    try{return JSON.parse(form.geometry);}catch{return null;}
  }

  async function searchScenes(){
    const geometry=parsedGeometry();
    if(!geometry||!form.baselineDate||!form.comparisonDate)return setMessage("Provide a valid AOI and both dates first.");
    setBusy(true);setMessage("");
    const req=(date:string)=>fetch("/api/remote-sensing/scenes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({geometry,date,windowDays:Number(form.windowDays),maxCloud:60})}).then(async r=>({ok:r.ok,json:await r.json().catch(()=>({}))}));
    const [b,c]=await Promise.all([req(form.baselineDate),req(form.comparisonDate)]);
    setBusy(false);
    if(!b.ok||!c.ok)return setMessage(b.json.error?.message||c.json.error?.message||"Scene discovery failed.");
    setSceneResults({baseline:b.json.data||[],comparison:c.json.data||[]});
    setMessage("Scene search completed. Lowest-cloud Sentinel-2 observations are shown below.");
  }

  async function createAndRun(){
    const geometry=parsedGeometry();
    if(!geometry)return setMessage("AOI geometry must be valid GeoJSON.");
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/analyses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      name:form.name,geometry,baselineDate:form.baselineDate,comparisonDate:form.comparisonDate,windowDays:Number(form.windowDays),threshold:Number(form.threshold)
    })});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setBusy(false);return setMessage(j.error?.message||"Could not create analysis.");}
    const id=j.data.id;
    await load();
    if(configured){
      const run=await fetch("/api/remote-sensing/analyses/"+id+"/run",{method:"POST"});
      const runJson=await run.json().catch(()=>({}));
      setBusy(false);
      await load();
      const latest=(await fetch("/api/remote-sensing/analyses/"+id).then(x=>x.json()).catch(()=>({}))).data;
      if(latest)setSelected(latest);
      return setMessage(run.ok?"NDVI comparison completed.":runJson.error?.message||"Analysis was created but processing failed.");
    }
    setBusy(false);
    setMessage("Analysis saved. Copernicus processing is waiting for OAuth configuration in Infrastructure settings.");
  }

  const scene=(s:any)=>s?<div className="scene-card"><strong>{s.id}</strong><span>{s.datetime?new Date(s.datetime).toLocaleString():"Unknown acquisition time"}</span><span>Cloud cover: {s.cloudCover==null?"—":Number(s.cloudCover).toFixed(1)+"%"}</span></div>:<div className="muted">No scene found in this window.</div>;

  return <div className="stack">
    {!configured&&<div className="notice"><strong>Scene discovery is ready now.</strong> Actual NDVI statistics and image processing will activate after CDSE_CLIENT_ID and CDSE_CLIENT_SECRET are configured.</div>}

    <section className="card stack">
      <div className="section-head"><div><h2>New Sentinel-2 vegetation comparison</h2><div className="muted">Compare the same area between two dates using Sentinel-2 Level-2A surface reflectance.</div></div><span className="badge">10 m NDVI</span></div>

      <div className="grid two">
        <div className="field"><label>Analysis name</label><input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Makurdi afforestation change · 2025 vs 2026"/></div>
        <div className="field"><label>Use existing forest / afforestation AOI</label><select value={form.forestId} onChange={e=>chooseForest(e.target.value)}><option value="">Paste/draw AOI manually</option>{forests.map(f=><option value={f.id} key={f.id}>{f.name} · {f.lga_code}</option>)}</select></div>
      </div>

      <div className="field"><label>AOI GeoJSON Polygon / MultiPolygon</label><textarea className="aoi-input" value={form.geometry} onChange={e=>setForm(x=>({...x,geometry:e.target.value,forestId:""}))} placeholder={polygonExample}/><div className="geometry-help">Use longitude, latitude coordinate order. Existing CARE-Map forest boundaries can be loaded from the selector above.</div></div>

      <div className="grid four">
        <div className="field"><label>Baseline date</label><input type="date" value={form.baselineDate} onChange={e=>setForm(x=>({...x,baselineDate:e.target.value}))}/></div>
        <div className="field"><label>Comparison date</label><input type="date" value={form.comparisonDate} onChange={e=>setForm(x=>({...x,comparisonDate:e.target.value}))}/></div>
        <div className="field"><label>Observation window</label><select value={form.windowDays} onChange={e=>setForm(x=>({...x,windowDays:e.target.value}))}><option value="3">3 days</option><option value="5">5 days</option><option value="7">7 days</option><option value="10">10 days</option><option value="14">14 days</option><option value="21">21 days</option><option value="30">30 days</option></select></div>
        <div className="field"><label>Vegetation threshold</label><select value={form.threshold} onChange={e=>setForm(x=>({...x,threshold:e.target.value}))}><option value="0.20">NDVI ≥ 0.20</option><option value="0.30">NDVI ≥ 0.30</option><option value="0.40">NDVI ≥ 0.40</option><option value="0.50">NDVI ≥ 0.50</option></select></div>
      </div>

      <div className="actions">
        <button className="btn" disabled={busy} onClick={searchScenes}>Search Sentinel-2 scenes</button>
        <button className="btn primary" disabled={busy||!form.name||!form.geometry||!form.baselineDate||!form.comparisonDate} onClick={createAndRun}>{busy?"Working…":configured?"Create & run NDVI comparison":"Save analysis for later processing"}</button>
      </div>
      {message&&<div className="notice">{message}</div>}

      {(sceneResults.baseline.length>0||sceneResults.comparison.length>0)&&<div className="grid two">
        <div><h3>Baseline candidate</h3>{scene(sceneResults.baseline[0])}</div>
        <div><h3>Comparison candidate</h3>{scene(sceneResults.comparison[0])}</div>
      </div>}
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Saved vegetation analyses</h2><div className="muted">AOIs and completed results remain part of CARE-Map for repeat analysis and publication.</div></div><span className="badge">{analyses.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Analysis</th><th>Dates</th><th>Area</th><th>Vegetation change</th><th>Clear pixels</th><th>Status</th><th>Map</th><th></th></tr></thead>
        <tbody>{analyses.map(a=><tr key={a.id} className={a.change_level==="critical"?"critical-row":""}>
          <td><strong>{a.name}</strong><div className="muted">{a.change_level} change level</div></td>
          <td>{String(a.baseline_date).slice(0,10)} → {String(a.comparison_date).slice(0,10)}</td>
          <td>{Number(a.aoi_area_ha||0).toLocaleString(undefined,{maximumFractionDigits:1})} ha</td>
          <td className={Number(a.vegetation_change_ha)<0?"overdue-text":""}>{a.vegetation_change_ha==null?"—":Number(a.vegetation_change_ha).toFixed(1)+" ha"}{a.vegetation_change_pct!=null?<div className="muted">{Number(a.vegetation_change_pct).toFixed(1)}%</div>:null}</td>
          <td>{a.baseline_clear_fraction==null?"—":(Number(a.baseline_clear_fraction)*100).toFixed(0)+"%"} / {a.comparison_clear_fraction==null?"—":(Number(a.comparison_clear_fraction)*100).toFixed(0)+"%"}</td>
          <td><span className="badge">{a.status.replaceAll("_"," ")}</span></td>
          <td>{a.publish_to_map?"Published":"Internal"}</td>
          <td><button className="btn" onClick={()=>setSelected(a)}>Open</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    {selected&&<RemoteSensingResultDrawer analysis={selected} onClose={()=>setSelected(null)} onUpdated={load}/>}
  </div>;
}
