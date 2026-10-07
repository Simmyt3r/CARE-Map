"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {environmentalHazardTypes,environmentalSeverities} from "@/lib/environmental-risk";

type Feature={type?:string;geometry?:{type?:string;coordinates?:unknown}|null;properties?:Record<string,unknown>};

export default function EnvironmentalRiskZoneManager(){
  const[source,setSource]=useState("");
  const[features,setFeatures]=useState<Feature[]>([]);
  const[fileName,setFileName]=useState("");
  const[defaultHazard,setDefaultHazard]=useState("flood");
  const[defaultSeverity,setDefaultSeverity]=useState("medium");
  const[verified,setVerified]=useState(false);
  const[sourceDate,setSourceDate]=useState("");
  const[data,setData]=useState<any[]>([]);
  const[imports,setImports]=useState<any[]>([]);
  const[summary,setSummary]=useState<any>({});
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  const load=useCallback(async()=>{
    const r=await fetch("/api/gis/risk-zones");
    const j=await r.json().catch(()=>({}));
    if(r.ok){setData(j.data||[]);setImports(j.imports||[]);setSummary(j.summary||{});}
  },[]);
  useEffect(()=>{void load();},[load]);

  const preview=useMemo(()=>features.slice(0,8),[features]);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
    try{
      const text=await file.text();
      const json=JSON.parse(text);
      if(json?.type!=="FeatureCollection"||!Array.isArray(json.features))throw new Error("Risk-zone file must be a GeoJSON FeatureCollection.");
      if(!json.features.length)throw new Error("Risk-zone file contains no features.");
      if(json.features.length>500)throw new Error("Risk-zone import is limited to 500 features.");
      setFeatures(json.features);
    }catch(e){
      setFeatures([]);
      setMessage(e instanceof Error?e.message:"Could not read risk-zone file.");
    }
  }

  async function importZones(){
    if(!features.length||!source.trim())return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/gis/risk-zones/import",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        source:source.trim(),features,verified,
        defaultHazardType:defaultHazard,defaultSeverity,
        defaultSourceDate:sourceDate||null
      })
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Risk-zone import failed.");
    setMessage("Imported "+j.data.imported+" of "+j.data.total+" risk zones. "+j.data.failed+" failed.");
    await load();
  }

  async function setVerification(id:string,value:boolean){
    const r=await fetch("/api/gis/risk-zones/"+id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({verified:value})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Risk-zone verification update failed.");
    setMessage(value?"Risk zone verified.":"Risk-zone verification revoked.");
    await load();
  }

  const label=(f:Feature)=>{
    const p=f.properties||{};
    return String(p.name||p.zoneName||p.zone_name||p.zoneCode||p.zone_code||"Unnamed zone");
  };

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Environmental risk zones</h2><div className="muted">Import project-approved flood, erosion and other hazard polygons with source provenance. Imported zones remain unverified unless explicitly approved.</div></div>
      <button className="btn" onClick={load}>Refresh</button>
    </div>

    <div className="stats">
      <div className="stat"><strong>{summary.total??"–"}</strong><span>Risk zones</span></div>
      <div className="stat"><strong>{summary.verified??"–"}</strong><span>Verified</span></div>
      <div className="stat"><strong>{summary.critical??"–"}</strong><span>Critical</span></div>
      <div className="stat"><strong>{summary.high??"–"}</strong><span>High</span></div>
      <div className="stat"><strong>{summary.source_datasets??"–"}</strong><span>Source datasets</span></div>
    </div>

    <div className="notice"><strong>Evidence rule:</strong> hazard polygons are imported evidence, not predictions created by CARE-Map. Record the real source/version and verify the dataset before using it in approved management statistics.</div>

    <div className="grid three">
      <div className="field"><label>Dataset source / version</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="Approved flood susceptibility layer · 2026"/></div>
      <div className="field"><label>Default hazard</label><select value={defaultHazard} onChange={e=>setDefaultHazard(e.target.value)}>{environmentalHazardTypes.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></div>
      <div className="field"><label>Default severity</label><select value={defaultSeverity} onChange={e=>setDefaultSeverity(e.target.value)}>{environmentalSeverities.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
    </div>
    <div className="grid three">
      <div className="field"><label>Source date</label><input type="date" value={sourceDate} onChange={e=>setSourceDate(e.target.value)}/></div>
      <div className="field"><label>GeoJSON polygons</label><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e=>e.target.files?.[0]&&void readFile(e.target.files[0])}/></div>
      <label className="check-field risk-verified-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Mark imported batch verified</label>
    </div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {features.length} features ready.</div>}
    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Geometry</th><th>Properties</th></tr></thead>
      <tbody>{preview.map((f,i)=><tr key={i}><td>{i+1}</td><td><strong>{label(f)}</strong></td><td>{f.geometry?.type||"Missing"}</td><td><code>{JSON.stringify(f.properties||{}).slice(0,180)}</code></td></tr>)}</tbody>
    </table></div>}

    <div className="actions">
      <button className="btn primary" disabled={busy||!features.length||!source.trim()} onClick={importZones}>{busy?"Importing…":"Validate & import risk zones"}</button>
      <a className="btn" href="/api/gis/risk-zones?format=geojson">Export risk zones GeoJSON</a>
    </div>
    {message&&<div className={message.startsWith("Imported")||message.endsWith("verified.")?"success":"notice"}>{message}</div>}

    {!!data.length&&<div>
      <h3>Risk-zone inventory</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Zone</th><th>Hazard</th><th>Severity</th><th>Area</th><th>Source</th><th>Verification</th></tr></thead>
        <tbody>{data.map(z=><tr key={z.id}>
          <td><strong>{z.name}</strong><div className="muted">{z.zone_code||"No code"}</div></td>
          <td>{z.hazard_type}</td>
          <td><span className={"priority-badge priority-"+z.severity}>{z.severity}</span></td>
          <td>{Number(z.area_km2||0).toLocaleString(undefined,{maximumFractionDigits:2})} km²</td>
          <td>{z.source}<div className="muted">{z.source_date?String(z.source_date).slice(0,10):"Undated"}</div></td>
          <td><button className={z.verified?"btn danger":"btn"} onClick={()=>setVerification(z.id,!z.verified)}>{z.verified?"Revoke verification":"Verify"}</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {!!imports.length&&<details className="geojson-details"><summary>Recent risk-zone imports</summary>
      <div className="table-wrap"><table><thead><tr><th>Source</th><th>Imported</th><th>Failed</th><th>Verified on import</th><th>Operator</th><th>Date</th></tr></thead>
      <tbody>{imports.map(i=><tr key={i.id}><td>{i.source}</td><td>{i.imported_features}/{i.total_features}</td><td>{i.failed_features}</td><td>{i.verified_on_import?"Yes":"No"}</td><td>{i.created_by_name||"—"}</td><td>{new Date(i.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
    </details>}
  </section>;
}
