"use client";
import {useEffect,useMemo,useState} from "react";
import SettlementAccessMap from "@/components/SettlementAccessMap";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function SettlementAccessAnalysis({lgas}:{lgas:any[]}){
  const availableLgas=useMemo(()=>lgas.filter(l=>Number(l.boundary_loaded)!==0||l.boundary_loaded===true),[lgas]);
  const[lga,setLga]=useState("");
  const[radius,setRadius]=useState("2000");
  const[includeUnverified,setIncludeUnverified]=useState(false);
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  useEffect(()=>{
    const source=availableLgas.length?availableLgas:lgas;
    if(!lga&&source.length)setLga(source[0].code);
    if(lga&&!source.some(x=>x.code===lga))setLga(source[0]?.code||"");
  },[availableLgas,lgas,lga]);

  function invalidate(){
    setResult(null);
    setMethodology(null);
    setMessage("");
  }

  async function run(){
    if(!lga)return setMessage("Choose an LGA before running settlement access analysis.");
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({lga,radius});
    if(includeUnverified)qs.set("includeUnverified","1");
    const r=await fetch("/api/gis/analysis/settlement-access?"+qs);
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){
      setResult(null);setMethodology(null);
      return setMessage(j.error?.message||"Settlement access analysis failed.");
    }
    setResult(j.data);
    setMethodology(j.methodology||null);
    const s=j.data.summary;
    setMessage(
      s.totalSettlements+" settlement"+(s.totalSettlements===1?"":"s")+" assessed; "+
      s.withinThreshold+" are within "+Number(j.data.thresholdM).toLocaleString()+
      " m of a functional borehole."
    );
  }

  function exportResult(){
    if(!result)return;
    const features:any[]=[];
    if(result.lga.boundary){
      features.push({
        type:"Feature",
        geometry:result.lga.boundary,
        properties:{role:"lga_boundary",code:result.lga.code,name:result.lga.name}
      });
    }
    for(const f of result.settlements?.features||[]){
      features.push({...f,properties:{...f.properties,role:"settlement"}});
    }
    for(const f of result.nearestBoreholes?.features||[]){
      features.push({...f,properties:{...f.properties,role:"functional_borehole"}});
    }
    for(const f of result.gapLines?.features||[]){
      features.push({...f,properties:{...f.properties,role:"gap_to_nearest_borehole"}});
    }
    for(const f of result.gaps?.features||[]){
      features.push({...f,properties:{...f.properties,role:"ranked_access_gap"}});
    }
    const km=Number(result.thresholdM)/1000;
    const filename=[
      result.lga.code.toLowerCase(),
      "settlement-borehole-access",
      String(km).replace(".","-")+"km.geojson"
    ].join("-");
    downloadGeoJson(filename,{type:"FeatureCollection",features});
  }

  const summary=result?.summary;
  const knownPopPct=summary?.knownPopulationAccessPct;

  return <section className="card stack">
    <div className="section-head">
      <div>
        <h2>Settlement access to functional boreholes</h2>
        <div className="muted">Measure straight-line proximity from verified communities to their nearest functional borehole. Population results only use settlements with sourced population values.</div>
      </div>
      {summary&&<span className="badge">{Number(summary.settlementAccessPct).toFixed(1)}% within threshold</span>}
    </div>

    <div className="grid three">
      <div className="field"><label>LGA</label><select value={lga} onChange={e=>{setLga(e.target.value);invalidate();}}>
        <option value="">Choose LGA</option>
        {(availableLgas.length?availableLgas:lgas).map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
      </select></div>
      <div className="field"><label>Access threshold</label><select value={radius} onChange={e=>{setRadius(e.target.value);invalidate();}}>
        <option value="500">500 m</option>
        <option value="1000">1 km</option>
        <option value="2000">2 km</option>
        <option value="5000">5 km</option>
        <option value="10000">10 km</option>
        <option value="25000">25 km</option>
      </select></div>
      <label className="check-field settlement-access-check"><input type="checkbox" checked={includeUnverified} onChange={e=>{setIncludeUnverified(e.target.checked);invalidate();}}/> Include unverified settlements</label>
    </div>

    {includeUnverified&&<div className="notice"><strong>Review mode:</strong> unverified settlement records are included. Do not use this result as an approved management statistic until the underlying records are verified.</div>}

    <div className="actions">
      <button className="btn primary" disabled={busy||!lga} onClick={run}>{busy?"Analyzing…":"Run access analysis"}</button>
      <button className="btn" disabled={!result} onClick={exportResult}>Export access GeoJSON</button>
    </div>

    {message&&<div className="notice">{message}</div>}

    {summary&&<div className="stats settlement-access-stats">
      <div className="stat"><strong>{summary.totalSettlements}</strong><span>Settlements assessed</span></div>
      <div className="stat"><strong>{summary.withinThreshold}</strong><span>Within threshold</span></div>
      <div className="stat"><strong>{summary.accessGaps}</strong><span>Access gaps</span></div>
      <div className="stat"><strong>{Number(summary.settlementAccessPct).toFixed(1)}%</strong><span>Settlement access</span></div>
      <div className="stat"><strong>{Number(summary.populationCompletenessPct).toFixed(1)}%</strong><span>Population data completeness</span></div>
      <div className="stat"><strong>{knownPopPct==null?"—":Number(knownPopPct).toFixed(1)+"%"}</strong><span>Known-population access</span></div>
    </div>}

    {summary&&summary.beyondSearchRadius>0&&<div className="notice">
      <strong>{summary.beyondSearchRadius}</strong> settlement{summary.beyondSearchRadius===1?"":"s"} had no functional borehole found within the {Number(result.nearestSearchRadiusM/1000).toLocaleString()} km search horizon. Their true nearest distance may be larger and is intentionally not invented.
    </div>}

    {summary&&<div className="population-evidence-card">
      <div className="section-head">
        <div><h3>Population evidence</h3><div className="muted">Calculated only from settlements that contain a population value with provenance.</div></div>
        <span className="badge">{summary.populationKnownSettlements}/{summary.totalSettlements} known</span>
      </div>
      <div className="grid three">
        <div><span>Known population</span><strong>{Number(summary.knownPopulationTotal).toLocaleString()}</strong></div>
        <div><span>Known population within threshold</span><strong>{Number(summary.knownPopulationWithin).toLocaleString()}</strong></div>
        <div><span>Known population in gaps</span><strong>{Number(summary.knownPopulationGap).toLocaleString()}</strong></div>
      </div>
      {summary.populationCompletenessPct<100&&<p className="muted">This is not an estimate of the LGA&apos;s total population. Missing settlement populations remain missing rather than being imputed.</p>}
    </div>}

    <SettlementAccessMap result={result}/>

    {!!result?.gaps?.features?.length&&<div className="stack">
      <div className="section-head">
        <div><h3>Highest-priority settlement gaps</h3><div className="muted">Ranked primarily by missing/longer borehole proximity, with population shown only when sourced.</div></div>
        <span className="badge">Top {result.gaps.features.length}</span>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Settlement</th><th>Nearest functional borehole</th><th>Distance</th><th>Population</th><th>Coordinates</th></tr></thead>
        <tbody>{result.gaps.features.map((gap:any)=><tr key={gap.properties.id}>
          <td><strong>#{gap.properties.rank}</strong></td>
          <td><strong>{gap.properties.name}</strong><div className="muted">{String(gap.properties.settlementType||"community").replaceAll("_"," ")}</div></td>
          <td>{gap.properties.nearestBoreholeName||"None found in search horizon"}</td>
          <td className="overdue-text">{gap.properties.nearestDistanceM==null?"> "+Number(result.nearestSearchRadiusM/1000).toLocaleString()+" km":Number(gap.properties.nearestDistanceM)<1000?Math.round(Number(gap.properties.nearestDistanceM)).toLocaleString()+" m":(Number(gap.properties.nearestDistanceM)/1000).toFixed(2)+" km"}</td>
          <td>{gap.properties.population==null?"Unknown":Number(gap.properties.population).toLocaleString()}<div className="muted">{gap.properties.populationYear||""}</div></td>
          <td>{Number(gap.properties.latitude).toFixed(5)}, {Number(gap.properties.longitude).toFixed(5)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice">
      <strong>Methodology:</strong> {methodology.note}
      <div className="muted">Population access percentage, when shown, covers only settlements with sourced population values. Straight-line distance is not walking distance.</div>
    </div>}
  </section>;
}
