"use client";
import {useState} from "react";
import EnvironmentalExposureMap from "@/components/EnvironmentalExposureMap";
import {environmentalHazardTypes,environmentalSeverities} from "@/lib/environmental-risk";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function EnvironmentalExposureAnalysis({lgas}:{lgas:any[]}){
  const[lga,setLga]=useState("");
  const[hazard,setHazard]=useState("");
  const[severity,setSeverity]=useState("low");
  const[includeUnverified,setIncludeUnverified]=useState(false);
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  async function run(){
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({severity});
    if(lga)qs.set("lga",lga);
    if(hazard)qs.set("hazard",hazard);
    if(includeUnverified)qs.set("includeUnverified","1");
    const r=await fetch("/api/gis/analysis/environmental-exposure?"+qs);
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){setResult(null);setMethodology(null);return setMessage(j.error?.message||"Environmental exposure analysis failed.");}
    setResult(j.data);setMethodology(j.methodology||null);
    setMessage(j.data.zoneCount+" risk zone"+(j.data.zoneCount===1?"":"s")+" matched. "+j.data.summary.settlements.exposed+" verified settlement"+(j.data.summary.settlements.exposed===1?"":"s")+" intersect the selected hazard footprint.");
  }

  function exportResult(){
    if(!result)return;
    const features:any[]=[];
    for(const collection of [result.zones,result.settlements,result.boreholes,result.assets,result.forests,result.reports]){
      for(const feature of collection?.features||[])features.push(feature);
    }
    const file=["environmental-exposure",lga||"all",hazard||"all-hazards",severity+"-plus"].join("-").toLowerCase()+".geojson";
    downloadGeoJson(file,{type:"FeatureCollection",features});
  }

  const s=result?.summary;
  return <section className="card stack">
    <div className="section-head"><div><h2>Environmental risk exposure</h2><div className="muted">Intersect verified imported hazard polygons with settlements, boreholes, assets, forests and open reports. Exposure means geometric intersection, not confirmed damage.</div></div>{result&&<span className="badge">{result.zoneCount} zones</span>}</div>

    <div className="grid four">
      <div className="field"><label>LGA scope</label><select value={lga} onChange={e=>{setLga(e.target.value);setResult(null);}}><option value="">All mapped LGAs / state view</option>{lgas.filter(x=>x.boundary_loaded).map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div className="field"><label>Hazard</label><select value={hazard} onChange={e=>{setHazard(e.target.value);setResult(null);}}><option value="">All hazards</option>{environmentalHazardTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
      <div className="field"><label>Minimum severity</label><select value={severity} onChange={e=>{setSeverity(e.target.value);setResult(null);}}>{environmentalSeverities.map(x=><option key={x} value={x}>{x}+</option>)}</select></div>
      <label className="check-field risk-review-check"><input type="checkbox" checked={includeUnverified} onChange={e=>{setIncludeUnverified(e.target.checked);setResult(null);}}/> Include unverified zones (review only)</label>
    </div>

    {includeUnverified&&<div className="notice">Review mode includes unverified hazard geometry. Do not use this result as an approved management statistic.</div>}
    <div className="actions"><button className="btn primary" disabled={busy} onClick={run}>{busy?"Analyzing…":"Run exposure analysis"}</button><button className="btn" disabled={!result} onClick={exportResult}>Export exposure GeoJSON</button></div>
    {message&&<div className="notice">{message}</div>}

    {s&&<div className="stats environmental-exposure-stats">
      <div className="stat"><strong>{s.settlements.exposed}/{s.settlements.total}</strong><span>Settlements exposed</span></div>
      <div className="stat"><strong>{Number(s.settlements.exposurePct).toFixed(1)}%</strong><span>Settlement exposure</span></div>
      <div className="stat"><strong>{s.boreholes.exposed}</strong><span>Boreholes exposed</span></div>
      <div className="stat"><strong>{s.assets.exposed}</strong><span>Assets exposed</span></div>
      <div className="stat"><strong>{s.forests.exposed}</strong><span>Forest sites exposed</span></div>
      <div className="stat"><strong>{s.openReports.exposed}</strong><span>Open reports in zones</span></div>
    </div>}

    {s&&<div className="population-evidence-card">
      <strong>Known-population exposure</strong>
      <div className="grid three">
        <div><span>Known population in scope</span><strong>{Number(s.population.knownTotal).toLocaleString()}</strong></div>
        <div><span>Known population exposed</span><strong>{Number(s.population.knownExposed).toLocaleString()}</strong></div>
        <div><span>Known-population exposure</span><strong>{s.population.knownExposurePct==null?"—":Number(s.population.knownExposurePct).toFixed(1)+"%"}</strong></div>
      </div>
      <p className="muted">Population completeness: {Number(s.population.completenessPct).toFixed(1)}% of verified settlements in scope have sourced population values. Missing populations are not imputed.</p>
    </div>}

    <EnvironmentalExposureMap result={result}/>

    {!!result?.zones?.features?.length&&<div className="stack">
      <div className="section-head"><div><h3>Zone exposure breakdown</h3><div className="muted">Per-zone counts can overlap; overall totals above use the unioned hazard footprint to avoid double-counting.</div></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Zone</th><th>Hazard</th><th>Severity</th><th>Area</th><th>Settlements</th><th>Known population</th><th>Boreholes</th><th>Assets</th><th>Forests</th><th>Open reports</th></tr></thead>
        <tbody>{result.zones.features.map((z:any)=><tr key={z.id}>
          <td><strong>{z.properties.name}</strong><div className="muted">{z.properties.source}</div></td>
          <td>{z.properties.hazardType}</td>
          <td><span className={"priority-badge priority-"+z.properties.severity}>{z.properties.severity}</span></td>
          <td>{Number(z.properties.areaKm2).toLocaleString(undefined,{maximumFractionDigits:2})} km²</td>
          <td>{z.properties.settlementCount}</td><td>{Number(z.properties.knownPopulation||0).toLocaleString()}</td>
          <td>{z.properties.boreholeCount}</td><td>{z.properties.assetCount}</td><td>{z.properties.forestSiteCount}</td><td>{z.properties.openReportCount}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice"><strong>Interpretation:</strong> {methodology.note}<div className="muted">Verified settlements are used for settlement statistics; population metrics only use records with sourced population values.</div></div>}
  </section>;
}
