"use client";
import {useEffect,useMemo,useState} from "react";
import SpatialAnalysisMap from "@/components/SpatialAnalysisMap";
import CoverageAnalysis from "@/components/CoverageAnalysis";
import SettlementAccessAnalysis from "@/components/SettlementAccessAnalysis";
import EnvironmentalExposureAnalysis from "@/components/EnvironmentalExposureAnalysis";

export default function SpatialAnalysis(){
  const[latitude,setLatitude]=useState("");
  const[longitude,setLongitude]=useState("");
  const[radius,setRadius]=useState("1000");
  const[type,setType]=useState("");
  const[results,setResults]=useState<any[]>([]);
  const[lgas,setLgas]=useState<any[]>([]);
  const[totals,setTotals]=useState<any|null>(null);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function loadLgas(){
    const r=await fetch("/api/gis/analysis/lgas");
    const j=await r.json().catch(()=>({}));
    if(r.ok){setLgas(j.data||[]);setTotals(j.totals||null);}
  }
  useEffect(()=>{loadLgas();},[]);

  function locate(){
    if(!navigator.geolocation)return setMessage("GPS is not available on this device.");
    setMessage("Reading current GPS…");
    navigator.geolocation.getCurrentPosition(
      p=>{setLatitude(p.coords.latitude.toFixed(6));setLongitude(p.coords.longitude.toFixed(6));setMessage("Current location captured with reported accuracy ±"+Math.round(p.coords.accuracy)+" m.");},
      ()=>setMessage("Could not read current location."),
      {enableHighAccuracy:true,timeout:12000,maximumAge:0}
    );
  }

  async function search(){
    const lat=Number(latitude),lng=Number(longitude),r=Number(radius);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return setMessage("Enter valid latitude and longitude.");
    setBusy(true);setMessage("");
    const qs=new URLSearchParams({lat:String(lat),lng:String(lng),radius:String(r),limit:"150"});
    if(type)qs.set("type",type);
    const response=await fetch("/api/gis/analysis/nearby?"+qs);
    const j=await response.json().catch(()=>({}));
    setBusy(false);
    if(!response.ok)return setMessage(j.error?.message||"Spatial analysis failed.");
    setResults(j.data||[]);
    setMessage((j.total||0)+" nearby feature"+((j.total||0)===1?"":"s")+" found within "+Number(j.query?.radiusM||r).toLocaleString()+" m.");
  }

  const nearest=useMemo(()=>results.slice(0,10),[results]);
  const latNum=latitude&&Number.isFinite(Number(latitude))?Number(latitude):null;
  const lngNum=longitude&&Number.isFinite(Number(longitude))?Number(longitude):null;

  return <div className="stack">
    <section className="card stack">
      <div className="section-head"><div><h2>Nearby search</h2><div className="muted">Find mapped interventions and open reports around any coordinate using PostGIS distance calculations.</div></div><span className="badge">{results.length} results</span></div>
      <div className="grid three">
        <div className="field"><label>Latitude</label><input inputMode="decimal" value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="7.7304"/></div>
        <div className="field"><label>Longitude</label><input inputMode="decimal" value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="8.5361"/></div>
        <div className="field"><label>Radius</label><select value={radius} onChange={e=>setRadius(e.target.value)}><option value="250">250 m</option><option value="500">500 m</option><option value="1000">1 km</option><option value="2000">2 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="25000">25 km</option><option value="50000">50 km</option></select></div>
      </div>
      <div className="grid two">
        <div className="field"><label>Feature type</label><select value={type} onChange={e=>setType(e.target.value)}><option value="">All mapped features + open reports</option><option value="borehole">Boreholes</option><option value="asset">Assets</option><option value="forest_site">Forest sites</option><option value="river">Verified rivers</option><option value="report">Open reports</option></select></div>
        <div className="actions analysis-actions"><button className="btn" type="button" onClick={locate}>Use current GPS</button><button className="btn primary" disabled={busy} onClick={search}>{busy?"Analyzing…":"Run spatial search"}</button></div>
      </div>
      {message&&<div className="notice">{message}</div>}
      <SpatialAnalysisMap latitude={latNum} longitude={lngNum} results={results}/>
      {!!nearest.length&&<div className="table-wrap"><table><thead><tr><th>Distance</th><th>Type</th><th>Name / description</th><th>LGA</th><th>Status / risk</th></tr></thead><tbody>{nearest.map(r=><tr key={r.entity_type+r.id}><td><strong>{Number(r.distance_m)<1000?Number(r.distance_m).toFixed(0)+" m":(Number(r.distance_m)/1000).toFixed(2)+" km"}</strong></td><td>{r.entity_type.replaceAll("_"," ")}</td><td>{r.name}</td><td>{r.lga_code||"—"}</td><td>{r.status||"—"}{r.risk_level?" · "+r.risk_level:""}</td></tr>)}</tbody></table></div>}
    </section>

    <CoverageAnalysis lgas={lgas}/>

    <SettlementAccessAnalysis lgas={lgas}/>

    <EnvironmentalExposureAnalysis lgas={lgas}/>

    <section className="card stack">
      <div className="section-head"><div><h2>LGA spatial summary</h2><div className="muted">Authoritative counts plus administrative area, forest area, river length and report location calculated from stored PostGIS geometries.</div></div><button className="btn" onClick={loadLgas}>Refresh</button></div>
      <div className="stats">
        <div className="stat"><strong>{totals?.settlements??"–"}</strong><span>Settlements</span></div>
        <div className="stat"><strong>{totals?.verified_settlements??"–"}</strong><span>Verified settlements</span></div>
        <div className="stat"><strong>{totals?.boreholes??"–"}</strong><span>Boreholes</span></div>
        <div className="stat"><strong>{totals?.assets??"–"}</strong><span>Assets</span></div>
        <div className="stat"><strong>{totals?.forest_area_ha!=null?Number(totals.forest_area_ha).toLocaleString(undefined,{maximumFractionDigits:1}):"–"}</strong><span>Forest hectares mapped</span></div>
        <div className="stat"><strong>{totals?.river_length_km!=null?Number(totals.river_length_km).toLocaleString(undefined,{maximumFractionDigits:1}):"–"}</strong><span>Verified river km</span></div>
        <div className="stat"><strong>{totals?.lga_boundaries??"–"}/23</strong><span>LGA boundaries loaded</span></div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>LGA</th><th>Boundary km²</th><th>Settlements</th><th>Verified</th><th>Boreholes</th><th>Functional</th><th>Needs attention</th><th>Assets</th><th>Forest ha</th><th>River km</th><th>Open reports in boundary</th><th>Linked reports</th></tr></thead>
        <tbody>{lgas.map(l=><tr key={l.code}><td><strong>{l.name}</strong>{l.pilot&&<span className="badge" style={{marginLeft:6}}>Pilot</span>}<div className="muted">{l.boundary_loaded?"Boundary loaded":"Boundary missing"}</div></td><td>{l.boundary_area_km2==null?"—":Number(l.boundary_area_km2).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>{l.settlements}</td><td>{l.verified_settlements}</td><td>{l.boreholes}</td><td>{l.functional_boreholes}</td><td className={Number(l.boreholes_needing_attention)>0?"overdue-text":""}>{l.boreholes_needing_attention}</td><td>{l.assets}</td><td>{Number(l.forest_area_ha).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>{Number(l.river_length_km).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td className={Number(l.spatial_critical_reports)>0?"overdue-text":""}>{l.spatial_open_reports}{Number(l.spatial_critical_reports)>0?<div className="muted">{l.spatial_critical_reports} critical</div>:null}</td><td>{l.linked_open_reports}</td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
