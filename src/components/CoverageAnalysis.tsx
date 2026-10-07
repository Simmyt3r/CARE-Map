"use client";
import {useEffect,useMemo,useState} from "react";
import CoverageAnalysisMap from "@/components/CoverageAnalysisMap";
import {
  coverageScenarioLabel,
  type CoverageResourceType,
  type CoverageScenario
} from "@/lib/coverage-analysis";

function downloadGeoJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function CoverageAnalysis({lgas}:{lgas:any[]}){
  const boundaryLgas=useMemo(()=>lgas.filter(l=>l.boundary_loaded),[lgas]);
  const[lga,setLga]=useState("");
  const[type,setType]=useState<CoverageResourceType>("borehole");
  const[scenario,setScenario]=useState<CoverageScenario>("functional");
  const[radius,setRadius]=useState("2000");
  const[result,setResult]=useState<any|null>(null);
  const[methodology,setMethodology]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  useEffect(()=>{
    if(!lga&&boundaryLgas.length)setLga(boundaryLgas[0].code);
    if(lga&&!boundaryLgas.some(x=>x.code===lga))setLga(boundaryLgas[0]?.code||"");
  },[boundaryLgas,lga]);

  function invalidate(){
    setResult(null);
    setMethodology(null);
    setMessage("");
  }

  async function run(){
    if(!lga)return setMessage("Import at least one LGA boundary before running coverage analysis.");
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({
      lga,
      type,
      scenario,
      radius
    });
    const r=await fetch("/api/gis/analysis/coverage?"+qs);
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){
      setResult(null);
      setMethodology(null);
      return setMessage(j.error?.message||"Coverage analysis failed.");
    }
    setResult(j.data);
    setMethodology(j.methodology||null);
    setMessage(
      Number(j.data.coveragePct||0).toFixed(1)+"% of "+j.data.lga.name+
      " falls within "+Number(j.data.radiusM).toLocaleString()+" m of the selected mapped resources."
    );
  }

  function exportResult(){
    if(!result)return;
    const features:any[]=[
      {
        type:"Feature",
        geometry:result.boundary,
        properties:{
          role:"lga_boundary",
          lga:result.lga.code,
          name:result.lga.name
        }
      }
    ];
    if(result.covered)features.push({
      type:"Feature",
      geometry:result.covered,
      properties:{role:"covered_area",radiusM:result.radiusM,coveragePct:result.coveragePct}
    });
    if(result.uncovered)features.push({
      type:"Feature",
      geometry:result.uncovered,
      properties:{role:"uncovered_area",radiusM:result.radiusM,coveragePct:result.coveragePct}
    });
    for(const feature of result.gaps?.features||[]){
      features.push({
        ...feature,
        properties:{...feature.properties,role:"uncovered_gap"}
      });
    }
    for(const feature of result.resources?.features||[]){
      features.push({
        ...feature,
        properties:{...feature.properties,role:"coverage_resource"}
      });
    }
    const km=Number(result.radiusM)/1000;
    const file=[
      result.lga.code.toLowerCase(),
      result.resourceType,
      String(km).replace(".","-")+"km",
      "coverage.geojson"
    ].join("-");
    downloadGeoJson(file,{type:"FeatureCollection",features});
  }

  const scenarioWarning=scenario==="non_decommissioned"
    ?"This planning footprint includes non-functional and needs-maintenance records. Do not interpret it as active service coverage."
    :null;

  return <section className="card stack">
    <div className="section-head">
      <div>
        <h2>Intervention coverage</h2>
        <div className="muted">Measure the share of an LGA&apos;s land area within a chosen straight-line distance of mapped point interventions.</div>
      </div>
      {result&&<span className="badge">{Number(result.coveragePct).toFixed(1)}% covered</span>}
    </div>

    {!boundaryLgas.length&&<div className="notice">No LGA boundaries are loaded yet. Import approved boundaries in GIS Workbench before using territorial coverage analysis.</div>}

    <div className="grid four">
      <div className="field"><label>LGA</label><select value={lga} onChange={e=>{setLga(e.target.value);invalidate();}}>
        <option value="">Choose LGA</option>
        {boundaryLgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
      </select></div>
      <div className="field"><label>Resource</label><select value={type} onChange={e=>{setType(e.target.value as CoverageResourceType);invalidate();}}>
        <option value="borehole">Boreholes</option>
        <option value="asset">Assets (all asset types)</option>
      </select></div>
      <div className="field"><label>Scenario</label><select value={scenario} onChange={e=>{setScenario(e.target.value as CoverageScenario);invalidate();}}>
        <option value="functional">Functional only</option>
        <option value="non_decommissioned">Mapped footprint (non-decommissioned)</option>
      </select></div>
      <div className="field"><label>Distance radius</label><select value={radius} onChange={e=>{setRadius(e.target.value);invalidate();}}>
        <option value="500">500 m</option>
        <option value="1000">1 km</option>
        <option value="2000">2 km</option>
        <option value="5000">5 km</option>
        <option value="10000">10 km</option>
        <option value="25000">25 km</option>
      </select></div>
    </div>

    {type==="asset"&&<div className="notice">Asset mode currently combines all mapped asset types. Treat the result as an infrastructure proximity footprint unless the selected assets represent one comparable service class.</div>}
    {scenarioWarning&&<div className="notice">{scenarioWarning}</div>}

    <div className="actions">
      <button className="btn primary" disabled={busy||!lga} onClick={run}>{busy?"Calculating…":"Run coverage analysis"}</button>
      <button className="btn" disabled={!result} onClick={exportResult}>Export coverage GeoJSON</button>
    </div>

    {message&&<div className="notice">{message}</div>}

    {result&&<div className="stats coverage-stats">
      <div className="stat"><strong>{Number(result.coveragePct).toFixed(1)}%</strong><span>Territorial coverage</span></div>
      <div className="stat"><strong>{Number(result.coveredAreaKm2).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Covered km²</span></div>
      <div className="stat"><strong>{Number(result.uncoveredAreaKm2).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>Uncovered km²</span></div>
      <div className="stat"><strong>{result.insideResourceCount}</strong><span>Resources inside LGA</span></div>
      <div className="stat"><strong>{result.externalSupportingCount}</strong><span>Cross-boundary support</span></div>
    </div>}

    {result&&<div className="coverage-meter" aria-label={"Coverage "+Number(result.coveragePct).toFixed(1)+" percent"}>
      <span style={{width:Math.max(0,Math.min(100,Number(result.coveragePct)))+"%"}}/>
    </div>}

    <CoverageAnalysisMap result={result}/>

    {!!result?.gaps?.features?.length&&<div className="stack">
      <div className="section-head"><div><h3>Largest uncovered gaps</h3><div className="muted">Ranked polygon gaps larger than 1,000 m². Coordinates use a representative point inside each gap.</div></div><span className="badge">{result.gaps.features.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Area</th><th>Latitude</th><th>Longitude</th></tr></thead>
        <tbody>{result.gaps.features.slice(0,10).map((gap:any)=><tr key={gap.properties.rank}>
          <td><strong>#{gap.properties.rank}</strong></td>
          <td>{Number(gap.properties.areaKm2).toLocaleString(undefined,{maximumFractionDigits:3})} km²</td>
          <td>{Number(gap.properties.latitude).toFixed(6)}</td>
          <td>{Number(gap.properties.longitude).toFixed(6)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {result&&methodology&&<div className="notice">
      <strong>Interpretation:</strong> {methodology.note}
      <div className="muted">This is territorial geometry, not a population-served estimate.</div>
    </div>}

    {result&&<div className="resource-facts">
      <div><span>Scenario</span><strong>{coverageScenarioLabel(result.scenario)}</strong></div>
      <div><span>Resource type</span><strong>{String(result.resourceType).replaceAll("_"," ")}</strong></div>
      <div><span>Radius</span><strong>{Number(result.radiusM).toLocaleString()} m</strong></div>
      <div><span>LGA area</span><strong>{Number(result.lgaAreaKm2).toLocaleString(undefined,{maximumFractionDigits:1})} km²</strong></div>
      <div><span>Boundary source</span><strong>{result.lga.boundarySource||"Not recorded"}</strong></div>
      <div><span>Total contributing resources</span><strong>{result.resourceCount}</strong></div>
    </div>}
  </section>;
}
