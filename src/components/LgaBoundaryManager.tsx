"use client";
import {useCallback,useEffect,useMemo,useState} from "react";

type BoundaryFeature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown}|null;
  properties?:Record<string,unknown>;
};

type BoundaryStatus={
  type:string;
  features:any[];
  summary:{total:number;mapped:number;missing:number};
  missing:{code:string;name:string;pilot:boolean}[];
};

export default function LgaBoundaryManager(){
  const[source,setSource]=useState("");
  const[features,setFeatures]=useState<BoundaryFeature[]>([]);
  const[fileName,setFileName]=useState("");
  const[status,setStatus]=useState<BoundaryStatus|null>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  const loadStatus=useCallback(async()=>{
    const r=await fetch("/api/gis/lga-boundaries");
    const j=await r.json().catch(()=>({}));
    if(r.ok)setStatus(j);
  },[]);

  useEffect(()=>{void loadStatus();},[loadStatus]);

  const preview=useMemo(()=>features.slice(0,8),[features]);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(data?.type!=="FeatureCollection"||!Array.isArray(data.features)){
        throw new Error("Boundary file must be a GeoJSON FeatureCollection.");
      }
      if(!data.features.length)throw new Error("Boundary file contains no features.");
      if(data.features.length>100)throw new Error("Boundary import is limited to 100 features.");
      setFeatures(data.features);
    }catch(e){
      setFeatures([]);
      setMessage(e instanceof Error?e.message:"Could not read boundary file.");
    }
  }

  async function importBoundaries(){
    if(!features.length||!source.trim())return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/gis/lga-boundaries",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({source:source.trim(),features})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Boundary import failed.");
    const d=j.data;
    setMessage("Imported "+d.imported+" of "+d.total+" LGA boundary features. "+d.failed+" failed.");
    await loadStatus();
  }

  const propLabel=(feature:BoundaryFeature)=>{
    const p=feature.properties||{};
    return String(p.code||p.lga_code||p.lgaCode||p.LGA_CODE||p.name||p.lga||p.LGA_NAME||p.NAME_2||"Unidentified");
  };

  return <section className="card stack">
    <div className="section-head">
      <div><h2>LGA administrative boundaries</h2><div className="muted">Load a verified Benue LGA GeoJSON dataset. CARE-Map stores the polygons, source provenance and import audit trail.</div></div>
      <button className="btn" onClick={loadStatus}>Refresh status</button>
    </div>

    <div className="stats">
      <div className="stat"><strong>{status?.summary?.mapped??"–"}</strong><span>Boundaries loaded</span></div>
      <div className="stat"><strong>{status?.summary?.missing??"–"}</strong><span>Still missing</span></div>
      <div className="stat"><strong>{status?.summary?.total??23}</strong><span>Benue LGAs</span></div>
    </div>

    <div className="notice">
      <strong>Provenance matters.</strong> Use an authoritative or project-approved boundary file and record its source/version below. CARE-Map will not pretend an unverified polygon is official merely because it arrived wearing GeoJSON.
    </div>

    <div className="grid two">
      <div className="field"><label>Boundary source / version</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Approved Benue SPMU boundary dataset · 2026-10"/></div>
      <div className="field"><label>GeoJSON FeatureCollection</label><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>
    </div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {features.length} boundary features ready. Match using <code>code</code>, <code>lga_code</code>, or a recognized LGA name.</div>}

    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr><th>#</th><th>Matched identifier candidate</th><th>Geometry</th><th>Properties</th></tr></thead>
      <tbody>{preview.map((feature,i)=><tr key={i}>
        <td>{i+1}</td>
        <td><strong>{propLabel(feature)}</strong></td>
        <td>{feature.geometry?.type||"Missing"}</td>
        <td><code>{JSON.stringify(feature.properties||{}).slice(0,180)}</code></td>
      </tr>)}</tbody>
    </table></div>}

    <div className="actions">
      <button className="btn primary" disabled={busy||!features.length||!source.trim()} onClick={importBoundaries}>{busy?"Importing…":"Validate & import boundaries"}</button>
    </div>

    {message&&<div className={message.startsWith("Imported")?"success":"notice"}>{message}</div>}

    {!!status?.features?.length&&<div>
      <h3>Loaded boundaries</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>LGA</th><th>Area</th><th>Source</th><th>Updated</th></tr></thead>
        <tbody>{status.features.map((feature:any)=><tr key={feature.properties.code}>
          <td><strong>{feature.properties.name}</strong><div className="muted">{feature.properties.code}</div></td>
          <td>{Number(feature.properties.areaKm2||0).toLocaleString(undefined,{maximumFractionDigits:1})} km²</td>
          <td>{feature.properties.source||"Not recorded"}</td>
          <td>{feature.properties.updatedAt?new Date(feature.properties.updatedAt).toLocaleString():"—"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {!!status?.missing?.length&&<div>
      <h3>Missing boundaries</h3>
      <div className="boundary-missing-list">{status.missing.map(x=><span className="badge" key={x.code}>{x.name}</span>)}</div>
    </div>}
  </section>;
}
