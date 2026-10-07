"use client";
import {useEffect,useMemo,useState} from "react";
import HazardExposureAnalysisMap from "@/components/HazardExposureAnalysisMap";
import {
  hazardSeverities,
  hazardTypeLabel,
  hazardTypes,
  type HazardSeverity,
  type HazardType
} from "@/lib/hazard-zones";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function HazardExposureAnalysis({lgas}:{lgas:any[]}){
  const boundaryLgas=useMemo(()=>lgas.filter(l=>l.boundary_loaded),[lgas]);
  const[lga,setLga]=useState("");
  const[zones,setZones]=useState<any[]>([]);
  const[zoneId,setZoneId]=useState("");
  const[hazardType,setHazardType]=useState("");
  const[severity,setSeverity]=useState("");
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  useEffect(()=>{
    if(!lga&&boundaryLgas.length)setLga(boundaryLgas[0].code);
    if(lga&&!boundaryLgas.some(x=>x.code===lga))setLga(boundaryLgas[0]?.code||"");
  },[boundaryLgas,lga]);

  useEffect(()=>{
    if(!lga){setZones([]);return;}
    setZoneId("");setResult(null);setMethodology(null);
    fetch("/api/gis/hazard-zones?verified=1&lga="+encodeURIComponent(lga))
      .then(r=>r.json()).then(j=>setZones(j.data||[])).catch(()=>setZones([]));
  },[lga]);

  function invalidate(){setResult(null);setMethodology(null);setMessage("");}

  async function run(){
    if(!lga)return setMessage("Choose an LGA with an imported administrative boundary.");
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({lga});
    if(zoneId)qs.set("zoneId",zoneId);
    if(hazardType)qs.set("hazardType",hazardType);
    if(severity)qs.set("severity",severity);

    const r=await fetch("/api/gis/analysis/hazard-exposure?"+qs);
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){
      setResult(null);setMethodology(null);
      return setMessage(j.error?.message||"Hazard exposure analysis failed.");
    }
    setResult(j.data);setMethodology(j.methodology||null);
    setMessage(
      j.data.totalExposed+" mapped feature"+(j.data.totalExposed===1?"":"s")+
      " intersect "+j.data.zoneCount+" verified hazard zone"+(j.data.zoneCount===1?"":"s")+
      " in "+j.data.lga.name+"."
    );
  }

  function exportResult(){
    if(!result)return;
    const features:any[]=[
      {type:"Feature",geometry:result.boundary,properties:{role:"lga_boundary",lga:result.lga.code,name:result.lga.name}}
    ];
    if(result.hazardUnion)features.push({
      type:"Feature",geometry:result.hazardUnion,
      properties:{role:"hazard_union",zoneCount:result.zoneCount,hazardAreaKm2:result.hazardAreaKm2,hazardAreaPct:result.hazardAreaPct}
    });
    for(const feature of result.zones?.features||[])features.push({...feature,properties:{...feature.properties,role:"verified_hazard_zone"}});
    for(const feature of result.features?.features||[])features.push({...feature,properties:{...feature.properties,role:"exposed_feature"}});
    const parts=[result.lga.code.toLowerCase(),result.hazardType||"all-hazards",result.severity||"all-severities","exposure.geojson"];
    downloadGeoJson(parts.join("-"),{type:"FeatureCollection",features});
  }

  const exposures=result?.features?.features||[];
  const includedZones=result?.zones?.features||[];
  const selectedZone=zones.find(z=>z.id===zoneId);

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Verified hazard exposure</h2><div className="muted">Intersect mapped settlements, infrastructure, and open reports with source-backed hazard polygons that staff have verified.</div></div>
      {result&&<span className="badge">{result.totalExposed} exposed</span>}
    </div>

    {!boundaryLgas.length&&<div className="notice">Import approved LGA boundaries before using hazard exposure analysis.</div>}

    <div className="grid four">
      <div className="field"><label>LGA</label><select value={lga} onChange={e=>{setLga(e.target.value);invalidate();}}>
        <option value="">Choose LGA</option>
        {boundaryLgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
      </select></div>

      <div className="field"><label>Hazard type</label><select value={hazardType} onChange={e=>{setHazardType(e.target.value);setZoneId("");invalidate();}}>
        <option value="">All hazard types</option>
        {hazardTypes.map(t=><option key={t} value={t}>{hazardTypeLabel(t)}</option>)}
      </select></div>

      <div className="field"><label>Severity</label><select value={severity} onChange={e=>{setSeverity(e.target.value);setZoneId("");invalidate();}}>
        <option value="">All severities</option>
        {hazardSeverities.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
      </select></div>

      <div className="field"><label>Specific verified zone</label><select value={zoneId} onChange={e=>{setZoneId(e.target.value);if(e.target.value){setHazardType("");setSeverity("");}invalidate();}}>
        <option value="">All matching verified zones</option>
        {zones.map(z=><option key={z.id} value={z.id}>{z.name} · {hazardTypeLabel(z.hazard_type as HazardType)} · {z.severity}</option>)}
      </select></div>
    </div>

    <div className="notice">
      <strong>Evidence scope:</strong> {selectedZone?selectedZone.name:"all verified zones matching the selected filters"}. CARE-Map trusts the imported dataset only to the extent justified by its recorded source, date, method, and staff verification.
    </div>

    <div className="actions">
      <button className="btn primary" disabled={busy||!lga} onClick={run}>{busy?"Analyzing…":"Run verified exposure analysis"}</button>
      <button className="btn" disabled={!result} onClick={exportResult}>Export exposure GeoJSON</button>
    </div>
    {message&&<div className="notice">{message}</div>}

    {result&&<div className="stats hazard-exposure-stats">
      <div className="stat"><strong>{result.zoneCount}</strong><span>Verified zones</span></div>
      <div className="stat"><strong>{Number(result.hazardAreaPct).toFixed(1)}%</strong><span>LGA area in selected zones</span></div>
      <div className="stat"><strong>{Number(result.hazardAreaKm2).toLocaleString(undefined,{maximumFractionDigits:2})}</strong><span>Hazard-zone km²</span></div>
      <div className="stat"><strong>{result.settlementsExposed}</strong><span>Verified settlements</span></div>
      <div className="stat"><strong>{result.boreholesExposed+result.assetsExposed}</strong><span>Infrastructure points</span></div>
      <div className="stat"><strong>{result.openReportsExposed}</strong><span>Open reports</span></div>
      <div className="stat"><strong>{Number(result.knownPopulationExposed).toLocaleString()}</strong><span>Known sourced population</span></div>
    </div>}

    <HazardExposureAnalysisMap result={result}/>

    {!!includedZones.length&&<div className="stack">
      <div className="section-head"><div><h3>Included verified hazard zones</h3><div className="muted">These are the polygons actually used in the exposure calculation after LGA clipping.</div></div><span className="badge">{includedZones.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Zone</th><th>Type</th><th>Severity</th><th>Source</th><th>Source date</th><th>Method</th></tr></thead>
        <tbody>{includedZones.map((f:any)=>{const p=f.properties||{};return <tr key={p.id}>
          <td><strong>{p.name}</strong></td>
          <td>{p.hazardType?hazardTypeLabel(p.hazardType as HazardType):"—"}</td>
          <td><span className={"priority-badge priority-"+(p.severity==="unknown"?"medium":p.severity)}>{p.severity||"unknown"}</span></td>
          <td>{p.source||"—"}</td><td>{p.sourceDate||"—"}</td><td>{p.method||"—"}</td>
        </tr>;})}</tbody>
      </table></div>
    </div>}

    {!!exposures.length&&<div className="stack">
      <div className="section-head"><div><h3>Mapped features inside verified zones</h3><div className="muted">Each point intersects the union of the selected verified hazard polygons.</div></div><span className="badge">{exposures.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Type</th><th>Name / description</th><th>Status / type</th><th>LGA</th><th>Population</th></tr></thead>
        <tbody>{exposures.slice(0,100).map((f:any)=>{const p=f.properties||{};return <tr key={p.entityType+p.id}>
          <td>{String(p.entityType||"").replaceAll("_"," ")}</td><td>{p.name||"—"}</td><td>{String(p.status||"—").replaceAll("_"," ")}</td>
          <td>{p.lga||result.lga.code}</td><td>{p.population==null?"—":Number(p.population).toLocaleString()}</td>
        </tr>;})}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice"><strong>Interpretation:</strong> {methodology.note}</div>}

    {result&&<div className="resource-facts">
      <div><span>LGA</span><strong>{result.lga.name}</strong></div>
      <div><span>Highest included severity</span><strong>{result.highestSeverity}</strong></div>
      <div><span>LGA area</span><strong>{Number(result.lgaAreaKm2).toLocaleString(undefined,{maximumFractionDigits:1})} km²</strong></div>
      <div><span>Hazard area</span><strong>{Number(result.hazardAreaKm2).toLocaleString(undefined,{maximumFractionDigits:2})} km²</strong></div>
      <div><span>Settlements with sourced population</span><strong>{result.settlementsWithPopulation}</strong></div>
      <div><span>Boundary source</span><strong>{result.lga.boundarySource||"Not recorded"}</strong></div>
    </div>}
  </section>;
}
