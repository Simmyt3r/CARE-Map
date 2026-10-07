"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {hazardSeverities,hazardTypeLabel,type HazardType} from "@/lib/hazard-zones";

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

export default function HazardZoneManager(){
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
    const r=await fetch("/api/gis/hazard-zones");
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
      if(!data.features.length)throw new Error("GeoJSON contains no hazard polygons.");
      if(data.features.length>1000)throw new Error("Hazard-zone import is limited to 1,000 features per batch.");
      setFeatures(data.features);
    }catch(e){
      setFeatures([]);
      setMessage(e instanceof Error?e.message:"Could not read hazard-zone GeoJSON.");
    }
  }

  async function importZones(){
    if(!features.length||!source.trim())return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/gis/hazard-zones",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        source:source.trim(),
        sourceDate:sourceDate||null,
        verified,
        features
      })
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Hazard-zone import failed.");
    const d=j.data;
    setMessage("Imported "+d.imported+" of "+d.total+" hazard polygons. "+d.failed+" failed.");
    await load();
  }

  async function patchZone(id:string,body:Record<string,unknown>,success:string){
    setMessage("");
    const r=await fetch("/api/gis/hazard-zones/"+id,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(body)
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Hazard zone update failed.");
    setMessage(success);
    await load();
  }

  async function exportGeoJson(){
    const r=await fetch("/api/gis/hazard-zones?format=geojson");
    if(!r.ok)return setMessage("Hazard-zone export failed.");
    const j=await r.json();
    download("care-map-hazard-zones.geojson",JSON.stringify(j,null,2),"application/geo+json");
  }

  const propLabel=(feature:Feature)=>{
    const p=feature.properties||{};
    return String(p.name||p.zoneName||p.zone_name||"Unnamed hazard zone");
  };

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Verified hazard zones</h2><div className="muted">Import source-backed flood, erosion and related hazard polygons. Unverified zones stay out of operational exposure analysis.</div></div>
      <button className="btn" onClick={load}>Refresh</button>
    </div>

    <div className="stats hazard-zone-stats">
      <div className="stat"><strong>{summary?.total??"–"}</strong><span>Hazard polygons</span></div>
      <div className="stat"><strong>{summary?.verified??"–"}</strong><span>Verified</span></div>
      <div className="stat"><strong>{summary?.unverified??"–"}</strong><span>Awaiting review</span></div>
      <div className="stat"><strong>{summary?.high_or_critical??"–"}</strong><span>High / critical</span></div>
      <div className="stat"><strong>{summary?.source_datasets??"–"}</strong><span>Sources</span></div>
    </div>

    <div className="notice"><strong>Evidence rule:</strong> only mark an imported batch verified when the GIS/M&E team accepts its source, date, method and geometry. A coloured polygon is not evidence merely because somebody exported it from QGIS.</div>

    <div className="grid three">
      <div className="field"><label>Dataset source / provenance</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Approved flood susceptibility map · Ministry/Project · version"/></div>
      <div className="field"><label>Source date</label><input type="date" value={sourceDate} onChange={e=>setSourceDate(e.target.value)}/></div>
      <label className="check-field hazard-verified-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Mark imported polygons verified</label>
    </div>

    <div className="field"><label>GeoJSON Polygon / MultiPolygon FeatureCollection</label><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {features.length} hazard features ready. Each feature needs <code>name</code>, <code>hazardType</code> and optional <code>severity</code>.</div>}

    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Geometry</th><th>Type</th><th>Severity</th><th>Properties</th></tr></thead>
      <tbody>{preview.map((feature,i)=>{
        const p=feature.properties||{};
        return <tr key={i}><td>{i+1}</td><td><strong>{propLabel(feature)}</strong></td><td>{feature.geometry?.type||"Missing"}</td><td>{String(p.hazardType||p.hazard_type||p.type||"—")}</td><td>{String(p.severity||"unknown")}</td><td><code>{JSON.stringify(p).slice(0,160)}</code></td></tr>;
      })}</tbody>
    </table></div>}

    <div className="actions">
      <button className="btn" onClick={exportGeoJson}>Export hazard GeoJSON</button>
      <button className="btn primary" disabled={busy||!features.length||!source.trim()} onClick={importZones}>{busy?"Importing…":"Validate & import hazard zones"}</button>
    </div>
    {message&&<div className={message.startsWith("Imported")||message.includes("verified")?"success":"notice"}>{message}</div>}

    {!!imports.length&&<div className="stack">
      <div className="section-head"><h3>Recent hazard imports</h3><span className="badge">{imports.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Source</th><th>Source date</th><th>Imported</th><th>Failed</th><th>Verified on import</th><th>By</th></tr></thead>
        <tbody>{imports.map(job=><tr key={job.id}>
          <td>{new Date(job.created_at).toLocaleString()}</td><td>{job.source}</td><td>{job.source_date||"—"}</td><td>{job.imported_features}/{job.total_features}</td>
          <td className={Number(job.failed_features)>0?"overdue-text":""}>{job.failed_features}</td><td>{job.verified_on_import?"Yes":"No"}</td><td>{job.created_by_name||"Unknown"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {!!recent.length&&<div className="stack">
      <div className="section-head"><h3>Hazard zone review</h3><span className="badge">{recent.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Zone</th><th>Type</th><th>Severity</th><th>Area</th><th>Source</th><th>Verification</th></tr></thead>
        <tbody>{recent.map(row=><tr key={row.id}>
          <td><strong>{row.name}</strong><div className="muted">{row.source_date||"No source date"}</div></td>
          <td>{hazardTypeLabel(row.hazard_type as HazardType)}</td>
          <td><select value={row.severity} onChange={e=>patchZone(row.id,{severity:e.target.value},"Hazard severity updated.")}>{hazardSeverities.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></td>
          <td>{Number(row.area_km2).toLocaleString(undefined,{maximumFractionDigits:3})} km²</td>
          <td>{row.source}</td>
          <td><button className={row.verified?"btn":"btn primary"} onClick={()=>patchZone(row.id,{verified:!row.verified},row.verified?"Hazard zone marked unverified.":"Hazard zone verified.")}>{row.verified?"Verified · revoke":"Verify"}</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </section>;
}
