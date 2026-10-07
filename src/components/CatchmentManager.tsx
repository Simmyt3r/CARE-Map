"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {catchmentLevelLabel,catchmentLevels} from "@/lib/catchments";

type Feature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown}|null;
  properties?:Record<string,unknown>;
};

function download(filename:string,text:string,type:string){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function CatchmentManager(){
  const[source,setSource]=useState("");
  const[sourceDate,setSourceDate]=useState("");
  const[verified,setVerified]=useState(false);
  const[features,setFeatures]=useState<Feature[]>([]);
  const[fileName,setFileName]=useState("");
  const[summary,setSummary]=useState<any|null>(null);
  const[recent,setRecent]=useState<any[]>([]);
  const[imports,setImports]=useState<any[]>([]);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const r=await fetch("/api/gis/catchments");
    const j=await r.json().catch(()=>({}));
    if(r.ok){setSummary(j.summary||null);setRecent(j.data||[]);setImports(j.imports||[]);}
  },[]);

  useEffect(()=>{void load();},[load]);
  const preview=useMemo(()=>features.slice(0,8),[features]);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(data?.type!=="FeatureCollection"||!Array.isArray(data.features))throw new Error("GeoJSON must be a FeatureCollection.");
      if(!data.features.length)throw new Error("GeoJSON contains no catchment polygons.");
      if(data.features.length>1000)throw new Error("Catchment import is limited to 1,000 features per batch.");
      setFeatures(data.features);
    }catch(e){
      setFeatures([]);
      setMessage(e instanceof Error?e.message:"Could not read catchment GeoJSON.");
    }
  }

  async function importCatchments(){
    if(!features.length||!source.trim())return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/gis/catchments",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({source:source.trim(),sourceDate:sourceDate||null,verified,features})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Catchment import failed.");
    const d=j.data;
    setMessage("Imported "+d.imported+" of "+d.total+" catchment polygons. "+d.failed+" failed.");
    await load();
  }

  async function patchCatchment(id:string,body:Record<string,unknown>,success:string){
    setMessage("");
    const r=await fetch("/api/gis/catchments/"+id,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(body)
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Catchment update failed.");
    setMessage(success);
    await load();
  }

  async function exportGeoJson(){
    const r=await fetch("/api/gis/catchments?format=geojson");
    if(!r.ok)return setMessage("Catchment export failed.");
    const j=await r.json();
    download("care-map-catchments.geojson",JSON.stringify(j,null,2),"application/geo+json");
  }

  const propLabel=(feature:Feature)=>{
    const p=feature.properties||{};
    return String(p.name||p.catchmentName||p.catchment_name||p.watershedName||p.watershed_name||"Unnamed catchment");
  };

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Catchments & landscape units</h2><div className="muted">Import verified basin, watershed, subcatchment, microcatchment, or project-landscape polygons with source provenance.</div></div>
      <button className="btn" onClick={load}>Refresh</button>
    </div>

    <div className="stats catchment-stats">
      <div className="stat"><strong>{summary?.total??"–"}</strong><span>Landscape units</span></div>
      <div className="stat"><strong>{summary?.verified??"–"}</strong><span>Verified</span></div>
      <div className="stat"><strong>{summary?.unverified??"–"}</strong><span>Awaiting review</span></div>
      <div className="stat"><strong>{summary?.watersheds??"–"}</strong><span>Watersheds</span></div>
      <div className="stat"><strong>{summary?.subcatchments??"–"}</strong><span>Subcatchments</span></div>
    </div>

    <div className="notice"><strong>Landscape rule:</strong> import only a GIS/M&E-approved delineation. CARE-Map stores the source and method because a watershed boundary is an analytical input, not decorative cartography.</div>

    <div className="grid three">
      <div className="field"><label>Dataset source / provenance</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Approved watershed delineation · DEM/workflow/version"/></div>
      <div className="field"><label>Source date</label><input type="date" value={sourceDate} onChange={e=>setSourceDate(e.target.value)}/></div>
      <label className="check-field catchment-verified-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Mark imported catchments verified</label>
    </div>

    <div className="field"><label>GeoJSON Polygon / MultiPolygon FeatureCollection</label><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {features.length} features ready. Each feature needs a name and may include <code>catchmentCode</code>, <code>catchmentLevel</code>, <code>method</code>, and <code>notes</code>.</div>}

    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Geometry</th><th>Level</th><th>Code</th><th>Properties</th></tr></thead>
      <tbody>{preview.map((feature,i)=>{const p=feature.properties||{};return <tr key={i}>
        <td>{i+1}</td><td><strong>{propLabel(feature)}</strong></td><td>{feature.geometry?.type||"Missing"}</td>
        <td>{String(p.catchmentLevel||p.catchment_level||p.level||p.type||"watershed")}</td>
        <td>{String(p.catchmentCode||p.catchment_code||p.code||"—")}</td>
        <td><code>{JSON.stringify(p).slice(0,170)}</code></td>
      </tr>;})}</tbody>
    </table></div>}

    <div className="actions">
      <button className="btn" onClick={exportGeoJson}>Export catchment GeoJSON</button>
      <button className="btn primary" disabled={busy||!features.length||!source.trim()} onClick={importCatchments}>{busy?"Importing…":"Validate & import catchments"}</button>
    </div>
    {message&&<div className={message.startsWith("Imported")||message.includes("verified")?"success":"notice"}>{message}</div>}

    {!!imports.length&&<div className="stack">
      <div className="section-head"><h3>Recent catchment imports</h3><span className="badge">{imports.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Source</th><th>Source date</th><th>Imported</th><th>Failed</th><th>Verified on import</th><th>By</th></tr></thead>
        <tbody>{imports.map(job=><tr key={job.id}>
          <td>{new Date(job.created_at).toLocaleString()}</td><td>{job.source}</td><td>{job.source_date||"—"}</td>
          <td>{job.imported_features}/{job.total_features}</td><td className={Number(job.failed_features)>0?"overdue-text":""}>{job.failed_features}</td>
          <td>{job.verified_on_import?"Yes":"No"}</td><td>{job.created_by_name||"Unknown"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {!!recent.length&&<div className="stack">
      <div className="section-head"><h3>Landscape-unit review & hierarchy</h3><span className="badge">{recent.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Catchment</th><th>Level</th><th>Parent</th><th>Area</th><th>Source</th><th>Verification</th></tr></thead>
        <tbody>{recent.map(row=><tr key={row.id}>
          <td><strong>{row.name}</strong><div className="muted">{row.catchment_code||"No code"}</div></td>
          <td><select value={row.catchment_level} onChange={e=>patchCatchment(row.id,{level:e.target.value},"Catchment level updated.")}>{catchmentLevels.map(level=><option key={level} value={level}>{catchmentLevelLabel(level)}</option>)}</select></td>
          <td><select value={row.parent_id||""} onChange={e=>patchCatchment(row.id,{parentId:e.target.value||null},"Catchment parent updated.")}>
            <option value="">No parent</option>
            {recent.filter(parent=>parent.id!==row.id).map(parent=><option key={parent.id} value={parent.id}>{parent.name}</option>)}
          </select></td>
          <td>{Number(row.area_km2).toLocaleString(undefined,{maximumFractionDigits:2})} km²</td>
          <td>{row.source}</td>
          <td><button className={row.verified?"btn":"btn primary"} onClick={()=>patchCatchment(row.id,{verified:!row.verified},row.verified?"Catchment marked unverified.":"Catchment verified.")}>{row.verified?"Verified · revoke":"Verify"}</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </section>;
}
