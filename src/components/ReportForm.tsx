"use client";
import {useEffect,useState} from "react";

const QUEUE_KEY="caremap_report_queue_v1";
type ReportPayload={
  type:string;reporterName:string|null;reporterContact:string|null;description:string;
  latitude:number;longitude:number;gpsAccuracy:number|null;capturedAt:string|null;captureSource:"manual"|"device_gps";
};
type Queued={id:string;payload:ReportPayload;queuedAt:string};

function readQueue():Queued[]{
  try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]") as Queued[];}catch{return[];}
}
function writeQueue(items:Queued[]){localStorage.setItem(QUEUE_KEY,JSON.stringify(items));}

export default function ReportForm(){
  const[form,setForm]=useState({type:"problem_report",reporterName:"",reporterContact:"",description:"",latitude:"",longitude:"",gpsAccuracy:"",capturedAt:"",captureSource:"manual" as "manual"|"device_gps"});
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[queued,setQueued]=useState(0);
  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));

  useEffect(()=>{
    setQueued(readQueue().length);
    const flush=async()=>{
      if(!navigator.onLine)return;
      const current=readQueue();
      if(!current.length)return;
      const remaining:Queued[]=[];
      let sent=0;
      for(const item of current){
        try{
          const r=await fetch("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(item.payload)});
          if(r.ok)sent++;else remaining.push(item);
        }catch{remaining.push(item);break;}
      }
      writeQueue(remaining);
      setQueued(remaining.length);
      if(sent)setMessage(sent+" queued report"+(sent===1?"":"s")+" submitted after connection returned.");
    };
    void flush();
    window.addEventListener("online",flush);
    return()=>window.removeEventListener("online",flush);
  },[]);

  function locate(){
    if(!navigator.geolocation)return setMessage("Location capture is not available on this device.");
    setMessage("Reading high-accuracy GPS…");
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
        setMessage("GPS captured. Reported accuracy: ±"+Math.round(p.coords.accuracy)+" m.");
      },
      ()=>setMessage("Could not read your location. Enter the coordinates manually."),
      {enableHighAccuracy:true,timeout:12000,maximumAge:0}
    );
  }

  function manualCoordinate(k:"latitude"|"longitude",v:string){
    setForm(x=>({...x,[k]:v,gpsAccuracy:"",capturedAt:"",captureSource:"manual"}));
  }

  function payload():ReportPayload{
    return{
      type:form.type,
      reporterName:form.reporterName||null,
      reporterContact:form.reporterContact||null,
      description:form.description,
      latitude:Number(form.latitude),
      longitude:Number(form.longitude),
      gpsAccuracy:form.gpsAccuracy?Number(form.gpsAccuracy):null,
      capturedAt:form.capturedAt||null,
      captureSource:form.captureSource
    };
  }

  function queueOffline(data:ReportPayload){
    const current=readQueue();
    current.push({id:crypto.randomUUID(),payload:data,queuedAt:new Date().toISOString()});
    writeQueue(current);
    setQueued(current.length);
    setMessage("No reliable connection. This report is saved on this device and will retry automatically when internet returns.");
    setForm(x=>({...x,description:""}));
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const data=payload();
    if(!navigator.onLine){queueOffline(data);setBusy(false);return;}
    try{
      const r=await fetch("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
      const j=await r.json().catch(()=>({}));
      setBusy(false);
      if(!r.ok)return setMessage(j.error?.message||"Report could not be submitted.");
      setMessage("Report submitted successfully. Reference: "+j.data.id);
      setForm(x=>({...x,description:""}));
    }catch{
      setBusy(false);queueOffline(data);
    }
  }

  return <form className="card stack" onSubmit={submit}>
    {queued>0&&<div className="notice"><strong>{queued} report{queued===1?"":"s"} waiting for internet.</strong> Keep this browser data until they are submitted.</div>}
    <div className="grid two">
      <div className="field"><label>Report type</label><select value={form.type} onChange={e=>set("type",e.target.value)}><option value="problem_report">Problem / fault</option><option value="small_river_report">Unknown small river / stream</option></select></div>
      <div className="field"><label>Your name (optional)</label><input value={form.reporterName} onChange={e=>set("reporterName",e.target.value)}/></div>
    </div>
    <div className="field"><label>Contact (optional)</label><input value={form.reporterContact} onChange={e=>set("reporterContact",e.target.value)} placeholder="Phone or email"/></div>
    <div className="field"><label>Description</label><textarea required minLength={10} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe what you observed, nearby landmarks, severity, or local name."/></div>
    <div className="grid three">
      <div className="field"><label>Latitude</label><input required inputMode="decimal" value={form.latitude} onChange={e=>manualCoordinate("latitude",e.target.value)} placeholder="7.7304"/></div>
      <div className="field"><label>Longitude</label><input required inputMode="decimal" value={form.longitude} onChange={e=>manualCoordinate("longitude",e.target.value)} placeholder="8.5361"/></div>
      <div className="field"><label>GPS accuracy</label><input readOnly value={form.gpsAccuracy?("±"+form.gpsAccuracy+" m"):"Manual / unknown"}/></div>
    </div>
    <div className="actions"><button type="button" className="btn" onClick={locate}>Use my current GPS</button><button className="btn primary" disabled={busy}>{busy?"Submitting…":"Submit report"}</button></div>
    {message&&<div className={message.startsWith("Report submitted")||message.includes("submitted after")?"success":"notice"}>{message}</div>}
  </form>;
}
