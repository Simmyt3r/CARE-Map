"use client";
import {useEffect,useState} from "react";
import type {SpatialContext} from "@/lib/spatial-context";

export default function SpatialContextPanel({geometry,latitude,longitude,refreshKey}:{
  geometry?:{type:string;coordinates:unknown}|null;
  latitude?:string|number|null;longitude?:string|number|null;
  refreshKey?:number;
}){
  const[context,setContext]=useState<SpatialContext|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const hasGeometry=Boolean(geometry);
  const hasPoint=latitude!==undefined&&longitude!==undefined&&
    latitude!==null&&longitude!==null&&String(latitude).trim()!==""&&String(longitude).trim()!=="";
  const valid=hasGeometry||hasPoint;
  const geometryKey=geometry?JSON.stringify(geometry):"";
  async function lookup(signal?:AbortSignal){
    if(!valid){setMessage("Provide coordinates or a polygon to identify its location.");return;}
    setBusy(true);setMessage("");
    try{
      let response:Response;
      if(geometry){
        response=await fetch("/api/gis/analysis/context",{
          method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({geometry}),signal
        });
      }else{
        const params=new URLSearchParams({lat:String(latitude),lng:String(longitude),radius:"2500"});
        response=await fetch("/api/gis/analysis/context?"+params,{signal});
      }
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(json.error?.message||"Location identification unavailable.");
      if(signal?.aborted)return;
      setContext(json.data as SpatialContext);
    }catch(e){
      if(!signal?.aborted)setMessage(e instanceof Error?e.message:"Location identification failed.");
    }finally{if(!signal?.aborted)setBusy(false);}
  }
  // A search triggered by the parent provides the same identifying context
  // as standalone coordinate/AOI lookups. Keep other changes manual to save DB connections.
  useEffect(()=>{
    if(refreshKey===undefined||refreshKey<1)return;
    const controller=new AbortController();
    void lookup(controller.signal);
    return()=>controller.abort();
  },[refreshKey]);
  useEffect(()=>{setContext(null);setMessage("");},[geometryKey,latitude,longitude]);

  const distance=(m:number)=>m<1000?Math.round(m)+" m":(m/1000).toFixed(2)+" km";
  return <section className="card stack spatial-context-panel" aria-label="Identified geography and mapped assets">
    <div className="section-head">
      <div><h3>Where is this analysis?</h3>
        <p className="muted">Match the coordinates to stored LGA boundaries, named settlement points and registered project assets.</p>
      </div>
      <button type="button" className="btn" disabled={!valid||busy}
        onClick={()=>void lookup()}>{busy?"Checking map records…":"Identify area & assets"}</button>
    </div>
    {!valid&&<p className="muted">Choose a valid polygon or enter latitude and longitude to identify it.</p>}
    {message&&<div className="notice" role="status">{message}</div>}
    {context&&<div className="stack">
      <div className="resource-facts">
        <div><span>State (mapped)</span><strong>{context.state?context.state+" State":"Not established"}</strong></div>
        <div><span>Local government area{context.lgas.length!==1?"s":""}</span>
          <strong>{context.lgas.length?context.lgas.map(l=>l.name).join(", "):"No LGA boundary match"}</strong></div>
        <div><span>Registered asset matches</span><strong>{context.assetCount}{context.assetListTruncated?"+":""}</strong></div>
        <div><span>Community reference</span><strong>{context.communities[0]?.name||"Not found in database"}</strong></div>
      </div>
      {!!context.lgas.length&&<div className="stack">
        <strong>Administrative boundary matches</strong>
        <div className="gis-context-pills">{context.lgas.map(l=><span className="badge" key={l.code}>
          {l.name} LGA{l.coveragePct!==null?" · "+l.coveragePct.toFixed(1)+"% of AOI":""}
        </span>)}</div>
      </div>}
      {!!context.communities.length&&<div className="stack">
        <strong>Mapped communities / settlements</strong>
        <p className="muted">Settlements are stored as points. A point inside the polygon does not establish the community's full geographic boundary or its own NDVI change.</p>
        <div className="table-wrap"><table><thead><tr><th>Settlement</th><th>Relation</th><th>Data quality</th></tr></thead>
          <tbody>{context.communities.map(c=><tr key={c.id}><td>{c.name}</td>
            <td>{c.inside?"Mapped point inside analysis":distance(c.distanceM)+" from analysis"}</td>
            <td>{c.verified?"Verified record":"Unverified record"}</td></tr>)}</tbody></table></div>
      </div>}
      {!!context.assets.length&&<div className="stack">
        <strong>Assets found {context.scope==="area"?"in the analysis area":"at or near the coordinates"}</strong>
        <div className="table-wrap"><table><thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Relation</th></tr></thead>
          <tbody>{context.assets.map(a=><tr key={a.kind+a.id}><td>{a.name}</td>
            <td>{a.kind.replaceAll("_"," ")}</td><td>{a.status||"—"}</td>
            <td>{a.inside?"Intersects location":distance(a.distanceM)+" away"}</td></tr>)}</tbody></table></div>
      </div>}
      {!!context.warnings.length&&<div className="notice" role="status">
        <strong>Interpretation and data-quality notes</strong>
        <ul>{context.warnings.map(w=><li key={w}>{w}</li>)}</ul>
      </div>}
      <p className="muted">NDVI statistics, where available, describe the entire selected polygon. Community-level or LGA-level vegetation change needs a matching administrative/community analysis boundary; proximity alone is not attribution.</p>
    </div>}
  </section>;
}
