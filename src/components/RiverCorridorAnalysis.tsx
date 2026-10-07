"use client";
import {useEffect,useMemo,useState} from "react";
import RiverCorridorAnalysisMap from "@/components/RiverCorridorAnalysisMap";
import {riverCorridorScopeLabel} from "@/lib/river-corridor";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function RiverCorridorAnalysis({lgas}:{lgas:any[]}){
  const boundaryLgas=useMemo(()=>lgas.filter(l=>l.boundary_loaded),[lgas]);
  const[lga,setLga]=useState("");
  const[rivers,setRivers]=useState<any[]>([]);
  const[riverId,setRiverId]=useState("");
  const[radius,setRadius]=useState("500");
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  useEffect(()=>{
    if(!lga&&boundaryLgas.length)setLga(boundaryLgas[0].code);
    if(lga&&!boundaryLgas.some(x=>x.code===lga))setLga(boundaryLgas[0]?.code||"");
  },[boundaryLgas,lga]);

  useEffect(()=>{
    if(!lga){setRivers([]);return;}
    setRiverId("");setResult(null);setMethodology(null);
    fetch("/api/gis/analysis/river-corridor/options?lga="+encodeURIComponent(lga))
      .then(r=>r.json()).then(j=>setRivers(j.data||[])).catch(()=>setRivers([]));
  },[lga]);

  function invalidate(){setResult(null);setMethodology(null);setMessage("");}

  async function run(){
    if(!lga)return setMessage("Choose an LGA with an imported boundary.");
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({lga,radius});
    if(riverId)qs.set("riverId",riverId);
    const r=await fetch("/api/gis/analysis/river-corridor?"+qs);
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){setResult(null);setMethodology(null);return setMessage(j.error?.message||"River corridor analysis failed.");}
    setResult(j.data);setMethodology(j.methodology||null);
    setMessage(
      j.data.totalExposed+" mapped feature"+(j.data.totalExposed===1?"":"s")+
      " fall within "+Number(j.data.radiusM).toLocaleString()+" m of the analyzed verified river geometry."
    );
  }

  function exportResult(){
    if(!result)return;
    const features:any[]=[
      {type:"Feature",geometry:result.boundary,properties:{role:"lga_boundary",lga:result.lga.code,name:result.lga.name}}
    ];
    if(result.corridor)features.push({type:"Feature",geometry:result.corridor,properties:{role:"river_corridor",radiusM:result.radiusM}});
    for(const feature of result.rivers?.features||[])features.push({...feature,properties:{...feature.properties,role:"verified_river"}});
    for(const feature of result.features?.features||[])features.push({...feature,properties:{...feature.properties,role:"exposed_feature"}});
    const scope=(result.riverId?"single-river":"all-rivers");
    downloadGeoJson(
      result.lga.code.toLowerCase()+"-"+scope+"-"+result.radiusM+"m-corridor-exposure.geojson",
      {type:"FeatureCollection",features}
    );
  }

  const exposures=result?.features?.features||[];
  const selectedRiver=rivers.find(r=>r.id===riverId);
  const scopeLabel=riverCorridorScopeLabel(selectedRiver?.name);

  return <section className="card stack">
    <div className="section-head">
      <div><h2>River corridor exposure</h2><div className="muted">Screen mapped features by straight-line proximity to verified river geometry. This is not a flood-risk model.</div></div>
      {result&&<span className="badge">{result.totalExposed} exposed</span>}
    </div>

    {!boundaryLgas.length&&<div className="notice">Import approved LGA boundaries before using river corridor analysis.</div>}

    <div className="grid four">
      <div className="field"><label>LGA</label><select value={lga} onChange={e=>{setLga(e.target.value);invalidate();}}>
        <option value="">Choose LGA</option>
        {boundaryLgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
      </select></div>
      <div className="field"><label>River scope</label><select value={riverId} onChange={e=>{setRiverId(e.target.value);invalidate();}}>
        <option value="">All verified rivers in LGA</option>
        {rivers.map(r=><option key={r.id} value={r.id}>{r.name} · {Number(r.length_km||0).toFixed(1)} km in LGA</option>)}
      </select></div>
      <div className="field"><label>Corridor distance</label><select value={radius} onChange={e=>{setRadius(e.target.value);invalidate();}}>
        <option value="100">100 m</option>
        <option value="250">250 m</option>
        <option value="500">500 m</option>
        <option value="1000">1 km</option>
        <option value="2000">2 km</option>
        <option value="5000">5 km</option>
        <option value="10000">10 km</option>
      </select></div>
      <div className="actions analysis-actions"><button className="btn primary" disabled={busy||!lga} onClick={run}>{busy?"Analyzing…":"Run corridor analysis"}</button></div>
    </div>

    <div className="notice"><strong>Scope:</strong> {scopeLabel}. Proximity can identify places worth checking, but elevation, rainfall, drainage, flood history and field observations are still required before calling anything a flood or erosion hazard.</div>

    <div className="actions"><button className="btn" disabled={!result} onClick={exportResult}>Export exposure GeoJSON</button></div>
    {message&&<div className="notice">{message}</div>}

    {result&&<div className="stats river-corridor-stats">
      <div className="stat"><strong>{Number(result.riverLengthKm).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Verified river km analyzed</span></div>
      <div className="stat"><strong>{result.settlementsExposed}</strong><span>Verified settlements</span></div>
      <div className="stat"><strong>{result.boreholesExposed}</strong><span>Boreholes</span></div>
      <div className="stat"><strong>{result.assetsExposed}</strong><span>Assets</span></div>
      <div className="stat"><strong>{result.openReportsExposed}</strong><span>Open reports</span></div>
      <div className="stat"><strong>{Number(result.knownPopulationExposed).toLocaleString()}</strong><span>Known sourced population</span></div>
    </div>}

    <RiverCorridorAnalysisMap result={result}/>

    {!!exposures.length&&<div className="stack">
      <div className="section-head"><div><h3>Nearest exposed features</h3><div className="muted">Sorted by straight-line distance to the analyzed river geometry.</div></div><span className="badge">{exposures.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Distance</th><th>Type</th><th>Name / description</th><th>Status / type</th><th>LGA</th><th>Population</th></tr></thead>
        <tbody>{exposures.slice(0,50).map((f:any)=>{
          const p=f.properties||{};const d=Number(p.distanceM||0);
          return <tr key={p.entityType+p.id}>
            <td><strong>{d<1000?d.toFixed(0)+" m":(d/1000).toFixed(2)+" km"}</strong></td>
            <td>{String(p.entityType||"").replaceAll("_"," ")}</td>
            <td>{p.name||"—"}</td>
            <td>{String(p.status||"—").replaceAll("_"," ")}</td>
            <td>{p.lga||result.lga.code}</td>
            <td>{p.population==null?"—":Number(p.population).toLocaleString()}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice"><strong>Interpretation:</strong> {methodology.note}</div>}

    {result&&<div className="resource-facts">
      <div><span>LGA</span><strong>{result.lga.name}</strong></div>
      <div><span>River scope</span><strong>{scopeLabel}</strong></div>
      <div><span>Corridor distance</span><strong>{Number(result.radiusM).toLocaleString()} m</strong></div>
      <div><span>Corridor area</span><strong>{Number(result.corridorAreaKm2).toLocaleString(undefined,{maximumFractionDigits:2})} km²</strong></div>
      <div><span>Verified rivers</span><strong>{result.riverCount}</strong></div>
      <div><span>Settlements with sourced population</span><strong>{result.settlementsWithPopulation}</strong></div>
    </div>}
  </section>;
}
