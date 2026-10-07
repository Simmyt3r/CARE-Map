"use client";
import {useEffect,useMemo,useState} from "react";
import CatchmentLandscapeAnalysisMap from "@/components/CatchmentLandscapeAnalysisMap";
import {catchmentLevelLabel,type CatchmentLevel} from "@/lib/catchments";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function CatchmentLandscapeAnalysis(){
  const[catchments,setCatchments]=useState<any[]>([]);
  const[catchmentId,setCatchmentId]=useState("");
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  useEffect(()=>{
    fetch("/api/gis/catchments?verified=1")
      .then(r=>r.json()).then(j=>setCatchments(j.data||[])).catch(()=>setCatchments([]));
  },[]);

  const selected=useMemo(()=>catchments.find(c=>c.id===catchmentId),[catchments,catchmentId]);

  async function run(){
    if(!catchmentId)return setMessage("Choose a verified catchment or landscape unit.");
    setBusy(true);setMessage("");
    const r=await fetch("/api/gis/analysis/catchment-landscape?catchmentId="+encodeURIComponent(catchmentId));
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){setResult(null);setMethodology(null);return setMessage(j.error?.message||"Catchment landscape analysis failed.");}
    setResult(j.data);setMethodology(j.methodology||null);
    setMessage(
      j.data.catchment.name+" landscape summary loaded across "+j.data.lgaCount+
      " intersecting LGA"+(j.data.lgaCount===1?"":"s")+"."
    );
  }

  function exportLandscape(){
    if(!result)return;
    const features:any[]=[
      {type:"Feature",geometry:result.boundary,properties:{
        role:"catchment_boundary",id:result.catchment.id,code:result.catchment.code,
        name:result.catchment.name,level:result.catchment.level,source:result.catchment.source
      }}
    ];
    const layerRoles:Record<string,string>={
      settlements:"settlement",
      boreholes:"borehole",
      assets:"asset",
      reports:"open_report",
      forests:"forest_site",
      vegetation:"published_vegetation_change",
      rivers:"verified_river",
      hazards:"verified_hazard_zone"
    };
    for(const [key,role] of Object.entries(layerRoles)){
      for(const feature of result.layers?.[key]?.features||[]){
        features.push({...feature,properties:{...feature.properties,role}});
      }
    }
    const slug=String(result.catchment.code||result.catchment.name)
      .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
    downloadGeoJson((slug||"catchment")+"-landscape-summary.geojson",{type:"FeatureCollection",features});
  }

  const boreholeRate=result?.boreholes?result.functionalBoreholes/result.boreholes*100:null;

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Catchment landscape planning</h2><div className="muted">Summarize environmental and intervention data inside one verified watershed, subcatchment, or project landscape.</div></div>
      {result&&<span className="badge">{catchmentLevelLabel(result.catchment.level as CatchmentLevel)}</span>}
    </div>

    {!catchments.length&&<div className="notice">No verified catchment polygons are available yet. Import and verify catchments in GIS Workbench first.</div>}

    <div className="grid two">
      <div className="field"><label>Verified landscape unit</label><select value={catchmentId} onChange={e=>{setCatchmentId(e.target.value);setResult(null);setMethodology(null);setMessage("");}}>
        <option value="">Choose catchment</option>
        {catchments.map(c=><option key={c.id} value={c.id}>{c.name} · {catchmentLevelLabel(c.catchment_level as CatchmentLevel)} · {Number(c.area_km2).toFixed(1)} km²</option>)}
      </select></div>
      <div className="actions analysis-actions">
        <button className="btn primary" disabled={busy||!catchmentId} onClick={run}>{busy?"Summarizing…":"Build landscape summary"}</button>
        <button className="btn" disabled={!result} onClick={exportLandscape}>Export landscape GeoJSON</button>
      </div>
    </div>

    {selected&&<div className="notice"><strong>Source:</strong> {selected.source}. {selected.method?<>Method: {selected.method}.</>:null} Verified landscape geometry is used as the common spatial boundary for the summary.</div>}
    {message&&<div className="notice">{message}</div>}

    {result&&<div className="stats catchment-analysis-stats">
      <div className="stat"><strong>{Number(result.catchmentAreaKm2).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Catchment km²</span></div>
      <div className="stat"><strong>{result.lgaCount}</strong><span>Intersecting LGAs</span></div>
      <div className="stat"><strong>{result.settlements}</strong><span>Verified settlements</span></div>
      <div className="stat"><strong>{Number(result.knownPopulation).toLocaleString()}</strong><span>Known sourced population</span></div>
      <div className="stat"><strong>{boreholeRate==null?"—":boreholeRate.toFixed(1)+"%"}</strong><span>Functional boreholes</span></div>
      <div className="stat"><strong>{Number(result.forestAreaHa).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Forest hectares</span></div>
      <div className="stat"><strong>{Number(result.riverLengthKm).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Verified river km</span></div>
      <div className="stat"><strong>{Number(result.hazardAreaKm2).toLocaleString(undefined,{maximumFractionDigits:2})}</strong><span>Verified hazard km²</span></div>
    </div>}

    <CatchmentLandscapeAnalysisMap result={result}/>

    {result&&<div className="grid two">
      <div className="drawer-section stack">
        <h3>Interventions & operations</h3>
        <div className="resource-facts">
          <div><span>Boreholes</span><strong>{result.boreholes}</strong></div>
          <div><span>Functional boreholes</span><strong>{result.functionalBoreholes}</strong></div>
          <div><span>Boreholes needing attention</span><strong>{result.boreholesNeedingAttention}</strong></div>
          <div><span>Assets</span><strong>{result.assets}</strong></div>
          <div><span>Functional assets</span><strong>{result.functionalAssets}</strong></div>
          <div><span>Assets needing attention</span><strong>{result.assetsNeedingAttention}</strong></div>
          <div><span>Open reports</span><strong>{result.openReports}</strong></div>
          <div><span>Critical / high reports</span><strong>{result.criticalReports} / {result.highReports}</strong></div>
        </div>
      </div>

      <div className="drawer-section stack">
        <h3>Landscape & monitoring</h3>
        <div className="resource-facts">
          <div><span>Forest sites</span><strong>{result.forestSites}</strong></div>
          <div><span>Verified rivers</span><strong>{result.verifiedRivers}</strong></div>
          <div><span>Verified hazard zones</span><strong>{result.verifiedHazardZones}</strong></div>
          <div><span>High / critical hazards</span><strong>{result.highCriticalHazards}</strong></div>
          <div><span>Published vegetation analyses</span><strong>{result.publishedVegetationAnalyses}</strong></div>
          <div><span>Latest vegetation comparison</span><strong>{result.latestVegetationDate||"—"}</strong></div>
          <div><span>Open vegetation alerts</span><strong>{result.openVegetationAlerts}</strong></div>
          <div><span>Population records available</span><strong>{result.settlementsWithPopulation}/{result.settlements}</strong></div>
        </div>
      </div>
    </div>}

    {!!result?.lgas?.length&&<div className="stack">
      <div className="section-head"><div><h3>Administrative overlap</h3><div className="muted">Catchments can cross LGA boundaries; overlap area is calculated geometrically.</div></div><span className="badge">{result.lgas.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>LGA</th><th>Catchment overlap</th><th>Share of catchment</th></tr></thead>
        <tbody>{result.lgas.map((l:any)=><tr key={l.code}>
          <td><strong>{l.name}</strong><div className="muted">{l.code}</div></td>
          <td>{Number(l.overlapKm2).toLocaleString(undefined,{maximumFractionDigits:2})} km²</td>
          <td>{result.catchmentAreaKm2?((Number(l.overlapKm2)/result.catchmentAreaKm2)*100).toFixed(1)+"%":"—"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice"><strong>Interpretation:</strong> {methodology.note}</div>}

    {result&&<div className="resource-facts">
      <div><span>Catchment</span><strong>{result.catchment.name}</strong></div>
      <div><span>Level</span><strong>{catchmentLevelLabel(result.catchment.level as CatchmentLevel)}</strong></div>
      <div><span>Code</span><strong>{result.catchment.code||"—"}</strong></div>
      <div><span>Source</span><strong>{result.catchment.source}</strong></div>
      <div><span>Source date</span><strong>{result.catchment.sourceDate||"—"}</strong></div>
      <div><span>Method</span><strong>{result.catchment.method||"Not recorded"}</strong></div>
    </div>}
  </section>;
}
