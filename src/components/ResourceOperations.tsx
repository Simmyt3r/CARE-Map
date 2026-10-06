/* eslint-disable @next/next/no-img-element */
"use client";
import {useEffect,useState} from "react";

type Kind="boreholes"|"assets"|"forest-sites"|"rivers";

export default function ResourceOperations({kind,row,onClose,onUpdated}:{kind:Kind;row:any;onClose:()=>void;onUpdated:()=>void}){
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[form,setForm]=useState({
    name:row.name||"",
    description:row.description||"",
    status:row.status||"functional",
    assetType:row.asset_type||"",
    boreholeCode:row.borehole_code||"",
    assetCode:row.asset_code||"",
    localName:row.local_name||"",
    stressIndicator:row.stress_indicator||"none",
    verified:Boolean(row.verified)
  });
  const[inspection,setInspection]=useState({condition:"good",notes:"",latitude:"",longitude:"",gpsAccuracy:""});
  const[inspections,setInspections]=useState<any[]>([]);
  const[maintenance,setMaintenance]=useState({performedAt:new Date().toISOString().slice(0,10),notes:""});
  const[photos,setPhotos]=useState<any[]>([]);
  const[photoFile,setPhotoFile]=useState<File|null>(null);
  const[photoCaption,setPhotoCaption]=useState("");

  async function loadInspections(){
    const r=await fetch("/api/resources/"+kind+"/"+row.id+"/inspections");
    if(r.ok){const j=await r.json();setInspections(j.data||[]);}
  }
  async function loadPhotos(){
    const r=await fetch("/api/resources/"+kind+"/"+row.id+"/photos");
    if(r.ok){const j=await r.json();setPhotos(j.data||[]);}
  }
  useEffect(()=>{loadInspections();loadPhotos();},[kind,row.id]);

  async function save(){
    setBusy(true);setMessage("");
    const body:any={name:form.name,description:form.description};
    if(kind==="boreholes"){body.status=form.status;body.boreholeCode=form.boreholeCode||null;}
    if(kind==="assets"){body.status=form.status;body.assetType=form.assetType;body.assetCode=form.assetCode||null;}
    if(kind==="rivers"){body.localName=form.localName||null;body.stressIndicator=form.stressIndicator;body.verified=form.verified;}
    const r=await fetch("/api/resources/"+kind+"/"+row.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Update failed.");
    setMessage("Record updated.");onUpdated();
  }

  function captureInspectionGps(){
    if(!navigator.geolocation)return setMessage("GPS is not available on this device.");
    navigator.geolocation.getCurrentPosition(p=>{
      setInspection(x=>({...x,latitude:p.coords.latitude.toFixed(6),longitude:p.coords.longitude.toFixed(6),gpsAccuracy:p.coords.accuracy.toFixed(1)}));
      setMessage("Inspection GPS captured with ±"+Math.round(p.coords.accuracy)+" m reported accuracy.");
    },()=>setMessage("Could not capture GPS. Enter coordinates manually."),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
  }

  async function addInspection(){
    setBusy(true);setMessage("");
    const body={
      condition:inspection.condition,
      notes:inspection.notes||null,
      latitude:inspection.latitude?Number(inspection.latitude):null,
      longitude:inspection.longitude?Number(inspection.longitude):null,
      gpsAccuracy:inspection.gpsAccuracy?Number(inspection.gpsAccuracy):null
    };
    const r=await fetch("/api/resources/"+kind+"/"+row.id+"/inspections",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Inspection could not be saved.");
    setInspection({condition:"good",notes:"",latitude:"",longitude:"",gpsAccuracy:""});
    setMessage("Inspection recorded.");await loadInspections();
  }

  async function addMaintenance(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/resources/"+kind+"/"+row.id+"/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(maintenance)});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Maintenance record could not be saved.");
    setMaintenance({performedAt:new Date().toISOString().slice(0,10),notes:""});
    setMessage("Maintenance record saved.");onUpdated();
  }

  async function uploadPhoto(){
    if(!photoFile)return setMessage("Choose an image first.");
    setBusy(true);setMessage("");
    const data=new FormData();
    data.set("file",photoFile);
    data.set("caption",photoCaption);
    const r=await fetch("/api/resources/"+kind+"/"+row.id+"/photos",{method:"POST",body:data});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Photo upload failed.");
    setPhotoFile(null);setPhotoCaption("");setMessage("Photo uploaded.");await loadPhotos();
  }

  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <aside className="resource-drawer">
      <div className="section-head"><div><h2>{row.name||row.local_name||"Resource"}</h2><div className="muted">{kind} · {row.lga_code}</div></div><button className="btn" onClick={onClose}>Close</button></div>
      <div className="actions" style={{marginTop:0,marginBottom:12}}><a className="btn" href={"/resource/"+kind+"/"+row.id} target="_blank" rel="noreferrer">Public page / QR label</a></div>

      <div className="stack">
        <section className="drawer-section stack">
          <h3>Edit record</h3>
          <div className="field"><label>Name</label><input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></div>
          {(kind==="boreholes"||kind==="assets")&&<div className="grid two">
            <div className="field"><label>Status</label><select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))}><option value="functional">Functional</option><option value="needs_maintenance">Needs maintenance</option><option value="non_functional">Non-functional</option><option value="decommissioned">Decommissioned</option></select></div>
            <div className="field"><label>{kind==="boreholes"?"Borehole code":"Asset code"}</label><input value={kind==="boreholes"?form.boreholeCode:form.assetCode} onChange={e=>setForm(x=>kind==="boreholes"?({...x,boreholeCode:e.target.value}):({...x,assetCode:e.target.value}))}/></div>
          </div>}
          {kind==="assets"&&<div className="field"><label>Asset type</label><input value={form.assetType} onChange={e=>setForm(x=>({...x,assetType:e.target.value}))}/></div>}
          {kind==="rivers"&&<div className="grid two"><div className="field"><label>Local name</label><input value={form.localName} onChange={e=>setForm(x=>({...x,localName:e.target.value}))}/></div><div className="field"><label>Stress indicator</label><select value={form.stressIndicator} onChange={e=>setForm(x=>({...x,stressIndicator:e.target.value}))}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><label className="check-field"><input type="checkbox" checked={form.verified} onChange={e=>setForm(x=>({...x,verified:e.target.checked}))}/> Verified river</label></div>}
          <div className="field"><label>Description</label><textarea value={form.description} onChange={e=>setForm(x=>({...x,description:e.target.value}))}/></div>
          <button className="btn primary" disabled={busy} onClick={save}>Save changes</button>
        </section>

        <section className="drawer-section stack">
          <div className="section-head"><div><h3>Site photos</h3><div className="muted">JPEG, PNG or WebP up to 4 MB.</div></div><span className="badge">{photos.length}</span></div>
          <div className="field"><label>Image</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoFile(e.target.files?.[0]||null)}/></div>
          <div className="field"><label>Caption</label><input value={photoCaption} onChange={e=>setPhotoCaption(e.target.value)} placeholder="Site condition, date, direction, or context"/></div>
          <button className="btn primary" disabled={busy||!photoFile} onClick={uploadPhoto}>Upload photo</button>
          {!!photos.length&&<div className="photo-grid">{photos.map(p=><a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="photo-card"><img src={p.url} alt={p.caption||"CARE-Map site photo"}/><div><strong>{p.caption||"Site photo"}</strong><small>{new Date(p.uploaded_at).toLocaleDateString()} · {p.uploaded_by_name||"Staff"}</small></div></a>)}</div>}
        </section>

        <section className="drawer-section stack">
          <h3>Field inspection</h3>
          <div className="field"><label>Condition</label><select value={inspection.condition} onChange={e=>setInspection(x=>({...x,condition:e.target.value}))}><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option><option value="critical">Critical</option></select></div>
          <div className="field"><label>Inspection notes</label><textarea value={inspection.notes} onChange={e=>setInspection(x=>({...x,notes:e.target.value}))} placeholder="What did you observe on site?"/></div>
          <div className="grid three"><div className="field"><label>Latitude</label><input value={inspection.latitude} onChange={e=>setInspection(x=>({...x,latitude:e.target.value}))}/></div><div className="field"><label>Longitude</label><input value={inspection.longitude} onChange={e=>setInspection(x=>({...x,longitude:e.target.value}))}/></div><div className="field"><label>Accuracy (m)</label><input value={inspection.gpsAccuracy} onChange={e=>setInspection(x=>({...x,gpsAccuracy:e.target.value}))}/></div></div>
          <div className="actions"><button className="btn" onClick={captureInspectionGps}>Capture inspection GPS</button><button className="btn primary" disabled={busy} onClick={addInspection}>Save inspection</button></div>
          {!!inspections.length&&<div className="inspection-list">{inspections.slice(0,5).map(i=><div key={i.id}><span className="badge">{i.condition}</span><strong>{new Date(i.inspected_at).toLocaleDateString()}</strong><small>{i.inspector_name||"Staff"}{i.gps_accuracy_m?" · ±"+Number(i.gps_accuracy_m).toFixed(1)+" m":""}</small>{i.notes&&<p>{i.notes}</p>}</div>)}</div>}
        </section>

        {(kind==="boreholes"||kind==="assets")&&<section className="drawer-section stack">
          <h3>Maintenance</h3>
          <div className="field"><label>Date performed</label><input type="date" value={maintenance.performedAt} onChange={e=>setMaintenance(x=>({...x,performedAt:e.target.value}))}/></div>
          <div className="field"><label>Work performed</label><textarea value={maintenance.notes} onChange={e=>setMaintenance(x=>({...x,notes:e.target.value}))} placeholder="Repair, replacement, servicing, inspection findings…"/></div>
          <button className="btn primary" disabled={busy} onClick={addMaintenance}>Record maintenance</button>
        </section>}

        {message&&<div className={message.includes("failed")||message.includes("could not")?"error":"notice"}>{message}</div>}
      </div>
    </aside>
  </div>;
}
