"use client";
import {useEffect,useMemo,useState} from "react";
import AoiSketchMap from "@/components/AoiSketchMap";
import RemoteSensingResultDrawer from "@/components/RemoteSensingResultDrawer";
import {parseAoiText} from "@/lib/aoi-editor";
import {comparisonWindowError} from "@/lib/sentinel-date-quality";

const polygonExample='{"type":"Polygon","coordinates":[[[8.50,7.70],[8.55,7.70],[8.55,7.75],[8.50,7.75],[8.50,7.70]]]}';

export default function RemoteSensingWorkbench(){
  const[analyses,setAnalyses]=useState<any[]>([]);
  const[forests,setForests]=useState<any[]>([]);
  const[configured,setConfigured]=useState(false);
  const[selected,setSelected]=useState<any|null>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[task,setTask]=useState<"scenes"|"processing"|null>(null);
  const[loaded,setLoaded]=useState(false);
  const[sceneResults,setSceneResults]=useState<{baseline:any[];comparison:any[]}>({baseline:[],comparison:[]});
  const[form,setForm]=useState({name:"",forestId:"",geometry:"",baselineDate:"",comparisonDate:"",windowDays:"7",threshold:"0.30"});

  async function load(){
    try{
      const [a,f]=await Promise.all([
        fetch("/api/remote-sensing/analyses",{cache:"no-store"}),
        fetch("/api/resources/forest-sites",{cache:"no-store"})
      ]);
      const aj=await a.json().catch(()=>({})),fj=await f.json().catch(()=>({}));
      if(!a.ok)throw new Error(aj.error?.message||"Could not load existing vegetation analyses.");
      setAnalyses(aj.data||[]);
      setConfigured(Boolean(aj.configured));
      if(f.ok)setForests(fj.data||[]);
    }catch(e){
      setMessage(e instanceof Error?e.message:"Unable to reach the satellite workbench.");
    }finally{setLoaded(true);}
  }
  useEffect(()=>{load();},[]);

  function chooseForest(id:string){
    if(!id){setForm(x=>({...x,forestId:""}));return;}
    const forest=forests.find(f=>f.id===id);
    if(!forest?.geometry){
      setMessage("This forest record has no mapped boundary. Draw a polygon or enter at least three corners.");
      setForm(x=>({...x,forestId:"",geometry:""}));
      return;
    }
    const parsed=parseAoiText(JSON.stringify(forest.geometry));
    if(!parsed.geometry){
      setMessage("Selected forest has no usable polygon: "+(parsed.error||"Create a mapped area of interest."));
      setForm(x=>({...x,forestId:"",geometry:""}));
      return;
    }
    setMessage("");
    setForm(x=>({...x,forestId:id,geometry:JSON.stringify(parsed.geometry),
      name:x.name||forest.name+" vegetation change"}));
  }

  const aoiResult=useMemo(()=>parseAoiText(form.geometry),[form.geometry]);
  const parsedAoi=aoiResult.geometry;

  function validateInputs(requireName:boolean){
    if(requireName&&!form.name.trim())return "Enter a name for this vegetation comparison.";
    if(!parsedAoi)return aoiResult.error||"Select an AOI: click at least three map corners, enter corners by latitude/longitude, or paste a Polygon GeoJSON.";
    if(!form.baselineDate||!form.comparisonDate)return "Choose both baseline and comparison dates.";
    const windowIssue=comparisonWindowError(form.baselineDate,form.comparisonDate,Number(form.windowDays));
    if(windowIssue)return windowIssue;
    return null;
  }

  async function searchScenes(){
    const validation=validateInputs(false);
    if(validation){setMessage(validation);return;}
    const geometry=parsedAoi!;
    setBusy(true);setTask("scenes");setMessage("");
    try{
      const req=async(date:string)=>{
        const response=await fetch("/api/remote-sensing/scenes",{
          method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({geometry,date,windowDays:Number(form.windowDays),maxCloud:60})
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body.error?.message||"Satellite scene search failed.");
        return body.data||[];
      };
      const [baseline,comparison]=await Promise.all([req(form.baselineDate),req(form.comparisonDate)]);
      setSceneResults({baseline,comparison});
      setMessage(baseline.length&&comparison.length
        ?"Sentinel-2 candidate scenes found for both periods. Review cloud coverage before processing."
        :"Some periods have no scenes meeting the cloud-cover filter. Try a wider observation window.");
    }catch(e){
      setMessage(e instanceof Error?e.message:"Scene discovery unavailable. Please retry.");
    }finally{setBusy(false);setTask(null);}
  }

  async function createAndRun(){
    const validation=validateInputs(true);
    if(validation){setMessage(validation);return;}
    const geometry=parsedAoi!;
    setBusy(true);setTask("processing");setMessage("");
    let savedId:string|null=null;
    try{
      const response=await fetch("/api/remote-sensing/analyses",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          name:form.name,geometry,baselineDate:form.baselineDate,
          comparisonDate:form.comparisonDate,windowDays:Number(form.windowDays),
          threshold:Number(form.threshold)
        })
      });
      const created=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(created.error?.message||"Could not create analysis.");
      const id=created.data.id as string;
      savedId=id;
      if(configured){
        const run=await fetch("/api/remote-sensing/analyses/"+id+"/run",{method:"POST"});
        const result=await run.json().catch(()=>({}));
        if(!run.ok)throw new Error(result.error?.message||
          "Analysis was saved, but satellite processing failed. Open it from saved analyses to retry.");
        const details=await fetch("/api/remote-sensing/analyses/"+id).then(r=>r.json()).catch(()=>({}));
        if(details.data)setSelected(details.data);
        setMessage(result.data?.status==="needs_review"
          ?"Comparison saved for review: "+(result.data?.quality?.issues?.join(" ")||
            "One or both observation periods contain insufficient clear imagery.")
          :"NDVI comparison processed. Review the imagery and accuracy before publication.");
      }else{
        setMessage("Analysis saved for later. Copernicus processing needs server credentials.");
      }
      await load();
    }catch(e){
      const reason=e instanceof Error?e.message:"Remote sensing service is unavailable.";
      setMessage(savedId
        ?"Your area was saved, but NDVI processing could not finish: "+reason+" Open the saved analysis to retry."
        :reason);
      await load();
    }finally{
      setBusy(false);setTask(null);
    }
  }

  function reuseAnalysis(data:any){
    if(!data.aoi_geometry){
      setMessage("The selected analysis has no stored AOI geometry. Open the full analysis record and retry.");
      return;
    }
    const parsed=parseAoiText(JSON.stringify(data.aoi_geometry));
    if(!parsed.geometry){
      setMessage("Saved AOI cannot be reused: "+(parsed.error||"Invalid polygon."));
      return;
    }
    setForm({
      name:String(data.name||"Vegetation comparison")+" - revised",
      forestId:"",
      geometry:JSON.stringify(parsed.geometry),
      baselineDate:String(data.baseline_date||"").slice(0,10),
      comparisonDate:String(data.comparison_date||"").slice(0,10),
      windowDays:String(data.window_days||7),
      threshold:String(data.vegetation_threshold??0.3)
    });
    setSceneResults({baseline:[],comparison:[]});
    setSelected(null);
    setMessage("Saved area copied into a new comparison. Change the observation dates before processing; the previous analysis remains unchanged.");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  const scene=(s:any)=>s?<div className="scene-card"><strong>{s.id}</strong><span>{s.datetime?new Date(s.datetime).toLocaleString():"Unknown acquisition time"}</span><span>Cloud cover: {s.cloudCover==null?"—":Number(s.cloudCover).toFixed(1)+"%"}</span></div>:<div className="muted">No scene found in this window.</div>;

  return <div className="stack">
    <div className="gis-status-strip"><strong>Sentinel workflow</strong><span>1. Select an area</span><span>2. Compare dates</span><span>3. Review quality</span></div>
    {!loaded&&<div className="notice" role="status">Loading satellite analyses and existing forest sites…</div>}
    <div className="notice">Sentinel-2 observations are screened for cloud and incomplete coverage. At least 60% clear-pixel coverage in BOTH date windows is required before publishing results. Location boundaries are validated as closed WGS84 polygons.</div>
    {!configured&&<div className="notice"><strong>Scene discovery is ready now.</strong> Actual NDVI statistics and image processing will activate after CDSE_CLIENT_ID and CDSE_CLIENT_SECRET are configured.</div>}

    <section className="card stack">
      <div className="section-head"><div><h2>New Sentinel-2 vegetation comparison</h2><div className="muted">Compare the same area between two dates using Sentinel-2 Level-2A surface reflectance.</div></div><span className="badge">10 m NDVI</span></div>

      <div className="grid two">
        <div className="field"><label>Analysis name</label><input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Makurdi afforestation change · 2025 vs 2026"/></div>
        <div className="field"><label>Use existing forest / afforestation AOI</label><select value={form.forestId} onChange={e=>chooseForest(e.target.value)}><option value="">Paste/draw AOI manually</option>{forests.map(f=><option value={f.id} key={f.id}>{f.name} · {f.lga_code}</option>)}</select></div>
      </div>

      <div className="field"><label>Area of interest (AOI)</label>
        <div className="geometry-help">Click at least three map corners, enter each corner by latitude/longitude under the map, or paste Polygon GeoJSON. You cannot analyze only one location point.</div>
      </div>
      <AoiSketchMap geometry={parsedAoi} onChange={geometry=>setForm(x=>({...x,geometry:geometry?JSON.stringify(geometry):"",forestId:""}))}/>
      <details className="geojson-details"><summary>Advanced: paste/edit AOI GeoJSON</summary>
        <div className="field">
          <label htmlFor="aoi-geojson">GeoJSON Polygon or MultiPolygon</label>
          <textarea id="aoi-geojson" className="aoi-input" spellCheck={false}
            value={form.geometry} onChange={e=>setForm(x=>({...x,geometry:e.target.value,forestId:""}))}
            placeholder={polygonExample} aria-invalid={Boolean(aoiResult.error)}/>
          <div className="geometry-help">GeoJSON uses [longitude, latitude] pairs; close each ring by repeating its first coordinate. A single Polygon Feature is also accepted.</div>
          {aoiResult.error&&<div className="error" role="alert">{aoiResult.error}</div>}
          {parsedAoi&&<div className="success" role="status">Valid polygon area of interest.</div>}
        </div>
      </details>

      <div className="grid four">
        <div className="field"><label>Baseline date</label><input type="date" value={form.baselineDate} onChange={e=>setForm(x=>({...x,baselineDate:e.target.value}))}/></div>
        <div className="field"><label>Comparison date</label><input type="date" value={form.comparisonDate} onChange={e=>setForm(x=>({...x,comparisonDate:e.target.value}))}/></div>
        <div className="field"><label>Observation window</label><select value={form.windowDays} onChange={e=>setForm(x=>({...x,windowDays:e.target.value}))}><option value="3">3 days</option><option value="5">5 days</option><option value="7">7 days</option><option value="10">10 days</option><option value="14">14 days</option><option value="21">21 days</option><option value="30">30 days</option></select></div>
        <div className="field"><label>Vegetation threshold</label><select value={form.threshold} onChange={e=>setForm(x=>({...x,threshold:e.target.value}))}><option value="0.20">NDVI ≥ 0.20</option><option value="0.30">NDVI ≥ 0.30</option><option value="0.40">NDVI ≥ 0.40</option><option value="0.50">NDVI ≥ 0.50</option></select></div>
      </div>

      <div className="geometry-help">Choose completed satellite observation windows, not a date range extending into the future. October in Benue is often cloudy; January–February is a useful initial dry-season test window. The analysis will still require real usable imagery.</div>
      {form.baselineDate&&form.comparisonDate&&comparisonWindowError(form.baselineDate,form.comparisonDate,Number(form.windowDays))&&
        <div className="notice" role="alert">{comparisonWindowError(form.baselineDate,form.comparisonDate,Number(form.windowDays))}</div>}
      <div className="geometry-help">Required before processing: a valid area of interest, analysis name, baseline date and later comparison date. Click the button for guidance if anything is missing.</div>
      <div className="actions">
        <button className="btn" disabled={busy} onClick={searchScenes}>{task==="scenes"?"Searching scenes…":"Search Sentinel-2 scenes"}</button>
        <button className="btn primary" disabled={busy} onClick={createAndRun}>{task==="processing"?"Processing comparison…":configured?"Create & run NDVI comparison":"Save analysis for later processing"}</button>
      </div>
      {message&&<div className="notice" role="status">{message}</div>}

      {(sceneResults.baseline.length>0||sceneResults.comparison.length>0)&&<div className="grid two">
        <div><h3>Baseline candidate</h3>{scene(sceneResults.baseline[0])}</div>
        <div><h3>Comparison candidate</h3>{scene(sceneResults.comparison[0])}</div>
      </div>}
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Saved vegetation analyses</h2><div className="muted">AOIs and completed results remain part of CARE-Map for repeat analysis and publication.</div></div><span className="badge">{analyses.length}</span></div>
      {!analyses.length&&<div className="empty-state"><strong>No saved vegetation comparisons</strong>
        <p>Draw a small area of interest and choose two dates above to create your first comparison.</p>
      </div>}
      {!!analyses.length&&<div className="table-wrap"><table>
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
      </table></div>}
    </section>

    {selected&&<RemoteSensingResultDrawer analysis={selected} onClose={()=>setSelected(null)} onUpdated={load} onReuse={reuseAnalysis}/>}
  </div>;
}
