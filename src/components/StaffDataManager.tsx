"use client";
import {useEffect,useState} from "react";
import ResourceOperations from "@/components/ResourceOperations";

type Kind="boreholes"|"assets"|"forest-sites"|"rivers";
type Lga={code:string;name:string};
const labels:Record<Kind,string>={boreholes:"Boreholes",assets:"Assets","forest-sites":"Forest sites",rivers:"Rivers"};
const blank={
  name:"",lgaCode:"MAKURDI",status:"functional",assetType:"",siteType:"afforestation_site",source:"official",localName:"",
  latitude:"",longitude:"",geometry:"",description:"",lastMaintenanceDate:"",installationDate:"",
  code:"",gpsAccuracy:"",capturedAt:"",captureSource:"manual"
};

export default function StaffDataManager(){
  const[kind,setKind]=useState<Kind>("boreholes");
  const[rows,setRows]=useState<any[]>([]);
  const[lgas,setLgas]=useState<Lga[]>([]);
  const[form,setForm]=useState({...blank});
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[selected,setSelected]=useState<any|null>(null);

  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));

  async function load(){
    const r=await fetch("/api/resources/"+kind);
    const j=await r.json();
    setRows(j.data||[]);
  }

  useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[]));},[]);
  useEffect(()=>{setForm({...blank});setSelected(null);load();},[kind]);

  function locate(){
    if(!navigator.geolocation)return setMessage("GPS is not available on this device.");
    navigator.geolocation.getCurrentPosition(
      p=>{
        setForm(x=>({
          ...x,
          latitude:p.coords.latitude.toFixed(6),
          longitude:p.coords.longitude.toFixed(6),
          gpsAccuracy:p.coords.accuracy.toFixed(1),
          capturedAt:new Date(p.timestamp).toISOString(),
          captureSource:"device_gps"
        }));
        setMessage("GPS captured with reported accuracy ±"+Math.round(p.coords.accuracy)+" m.");
      },
      ()=>setMessage("GPS capture failed; enter coordinates manually."),
      {enableHighAccuracy:true,timeout:12000,maximumAge:0}
    );
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const body:any={...form};
    if(kind==="boreholes"||kind==="assets"){
      body.latitude=Number(form.latitude);
      body.longitude=Number(form.longitude);
      body.gpsAccuracy=form.gpsAccuracy?Number(form.gpsAccuracy):null;
      if(kind==="boreholes")body.boreholeCode=form.code||null;
      else body.assetCode=form.code||null;
    }else{
      try{body.geometry=JSON.parse(form.geometry);}
      catch{setBusy(false);return setMessage("Geometry must be valid GeoJSON.");}
    }
    const r=await fetch("/api/resources/"+kind,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not save record.");
    setMessage(labels[kind].replace(/s$/,"")+" saved.");
    setForm({...blank,lgaCode:form.lgaCode});
    load();
  }

  return <div className="stack">
    <div className="staff-tabs">{(Object.keys(labels)as Kind[]).map(k=><button key={k} className="btn" onClick={()=>setKind(k)}>{labels[k]}</button>)}</div>

    <form className="card stack" onSubmit={submit}>
      <div className="section-head"><div><h2>Add {labels[kind].toLowerCase().replace(/s$/,"")}</h2><div className="muted">{kind==="boreholes"||kind==="assets"?"Capture GPS accuracy in the field whenever possible.":"Paste valid GeoJSON geometry from QGIS or another GIS source."}</div></div></div>
      <div className="grid two">
        <div className="field"><label>Name</label><input required={kind!=="rivers"} value={form.name} onChange={e=>set("name",e.target.value)}/></div>
        <div className="field"><label>LGA</label><select value={form.lgaCode} onChange={e=>set("lgaCode",e.target.value)}>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      </div>

      {kind==="assets"&&<div className="field"><label>Asset type</label><input required value={form.assetType} onChange={e=>set("assetType",e.target.value)} placeholder="Irrigation pump, equipment, structure…"/></div>}
      {kind==="forest-sites"&&<div className="field"><label>Site type</label><select value={form.siteType} onChange={e=>set("siteType",e.target.value)}><option value="afforestation_site">Afforestation site</option><option value="forest">Forest</option></select></div>}
      {kind==="rivers"&&<div className="grid two"><div className="field"><label>Local name</label><input value={form.localName} onChange={e=>set("localName",e.target.value)}/></div><div className="field"><label>Source</label><select value={form.source} onChange={e=>set("source",e.target.value)}><option value="official">Official</option><option value="community_reported">Community reported</option></select></div></div>}

      {(kind==="boreholes"||kind==="assets")?<>
        <div className="grid three">
          <div className="field"><label>{kind==="boreholes"?"Borehole code":"Asset code"}</label><input value={form.code} onChange={e=>set("code",e.target.value)} placeholder={kind==="boreholes"?"BH-001":"AST-001"}/></div>
          <div className="field"><label>Latitude</label><input required inputMode="decimal" value={form.latitude} onChange={e=>set("latitude",e.target.value)}/></div>
          <div className="field"><label>Longitude</label><input required inputMode="decimal" value={form.longitude} onChange={e=>set("longitude",e.target.value)}/></div>
        </div>
        <div className="grid three">
          <div className="field"><label>GPS accuracy (m)</label><input inputMode="decimal" value={form.gpsAccuracy} onChange={e=>set("gpsAccuracy",e.target.value)} placeholder="e.g. 5.4"/></div>
          <div className="field"><label>Captured at</label><input value={form.capturedAt} onChange={e=>set("capturedAt",e.target.value)} placeholder="Filled automatically by device GPS"/></div>
          <div className="field"><label>Capture source</label><input readOnly value={form.captureSource}/></div>
        </div>
        <button type="button" className="btn" onClick={locate}>Capture current GPS + accuracy</button>
      </>:<div className="field"><label>GeoJSON geometry</label><textarea required value={form.geometry} onChange={e=>set("geometry",e.target.value)} placeholder={kind==="forest-sites"?'{"type":"Polygon","coordinates":[[[8.5,7.7],[8.6,7.7],[8.6,7.8],[8.5,7.7]]]}':'{"type":"LineString","coordinates":[[8.5,7.7],[8.6,7.8]]}'}/><div className="geometry-help">Coordinates are longitude first, latitude second. Polygon rings must close by repeating the first coordinate at the end.</div></div>}

      {(kind==="boreholes"||kind==="assets")&&<div className="field"><label>Status</label><select value={form.status} onChange={e=>set("status",e.target.value)}><option value="functional">Functional</option><option value="needs_maintenance">Needs maintenance</option><option value="non_functional">Non-functional</option><option value="decommissioned">Decommissioned</option></select></div>}
      <div className="field"><label>Description</label><textarea value={form.description} onChange={e=>set("description",e.target.value)}/></div>
      <button className="btn primary" disabled={busy}>{busy?"Saving…":"Save record"}</button>
      {message&&<div className="notice">{message}</div>}
    </form>

    <div className="card">
      <div className="section-head"><h2>{labels[kind]}</h2><span className="badge">{rows.length} records</span></div>
      <div className="table-wrap"><table><thead><tr><th>Name / Code</th><th>LGA</th><th>Status / Risk</th><th>GPS quality</th><th>Updated</th><th>Operations</th></tr></thead><tbody>
        {rows.map(r=><tr key={r.id}>
          <td><strong>{r.name||r.local_name||"Unnamed"}</strong>{(r.borehole_code||r.asset_code)&&<div className="muted">{r.borehole_code||r.asset_code}</div>}</td>
          <td>{r.lga_code}</td>
          <td>{kind==="rivers"?r.stress_indicator:r.status} · <span className="badge">{r.risk_level}</span></td>
          <td>{r.gps_accuracy_m!=null?("±"+Number(r.gps_accuracy_m).toFixed(1)+" m"):(kind==="boreholes"||kind==="assets"?"Not recorded":"—")}</td>
          <td>{r.updated_at?new Date(r.updated_at).toLocaleDateString():""}</td>
          <td><button className="btn" onClick={()=>setSelected(r)}>Manage</button></td>
        </tr>)}
      </tbody></table></div>
    </div>

    {selected&&<ResourceOperations kind={kind} row={selected} onClose={()=>setSelected(null)} onUpdated={load}/>}
  </div>;
}
