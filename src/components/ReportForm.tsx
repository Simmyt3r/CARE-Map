"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {PRIVACY_NOTICE_VERSION} from "@/lib/privacy";
import {useI18n} from "@/components/LocalizationProvider";

const QUEUE_KEY="caremap_report_queue_v1";
type ReportPayload={
  type:string;reporterName:string|null;reporterContact:string|null;description:string;
  latitude:number;longitude:number;gpsAccuracy:number|null;capturedAt:string|null;captureSource:"manual"|"device_gps";
  relatedEntityType:"borehole"|"asset"|"forest_site"|"river"|null;relatedEntityId:string|null;
  privacyAcknowledged:true;privacyNoticeVersion:string;optionalContactConsent:boolean;
};
type Queued={id:string;payload:ReportPayload;queuedAt:string};

function readQueue():Queued[]{
  try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]") as Queued[];}catch{return[];}
}
function writeQueue(items:Queued[]){localStorage.setItem(QUEUE_KEY,JSON.stringify(items));}

export default function ReportForm({relatedEntityType=null,relatedEntityId=null,relatedName="",initialLatitude="",initialLongitude=""}:{relatedEntityType?:"borehole"|"asset"|"forest_site"|"river"|null;relatedEntityId?:string|null;relatedName?:string;initialLatitude?:string;initialLongitude?:string}){
  const{t}=useI18n();
  const[form,setForm]=useState({type:"problem_report",reporterName:"",reporterContact:"",description:"",latitude:initialLatitude,longitude:initialLongitude,gpsAccuracy:"",capturedAt:"",captureSource:"manual" as "manual"|"device_gps"});
  const[message,setMessage]=useState("");
  const[privacyAcknowledged,setPrivacyAcknowledged]=useState(false);
  const[optionalContactConsent,setOptionalContactConsent]=useState(false);
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
      if(sent)setMessage(sent+" "+t("report.reconnectSubmittedSuffix"));
    };
    void flush();
    window.addEventListener("online",flush);
    return()=>window.removeEventListener("online",flush);
  },[t]);

  function locate(){
    if(!navigator.geolocation)return setMessage(t("report.gpsUnavailable"));
    setMessage(t("report.gpsReading"));
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
        setMessage(t("report.gpsCapturedPrefix")+" ±"+Math.round(p.coords.accuracy)+" m.");
      },
      ()=>setMessage(t("report.gpsFailed")),
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
      captureSource:form.captureSource,
      relatedEntityType:relatedEntityType||null,
      relatedEntityId:relatedEntityId||null,
      privacyAcknowledged:true,
      privacyNoticeVersion:PRIVACY_NOTICE_VERSION,
      optionalContactConsent
    };
  }

  function queueOffline(data:ReportPayload){
    const current=readQueue();
    current.push({id:crypto.randomUUID(),payload:data,queuedAt:new Date().toISOString()});
    writeQueue(current);
    setQueued(current.length);
    setMessage(t("report.offlineSaved"));
    setForm(x=>({...x,description:""}));
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    if(!privacyAcknowledged){setBusy(false);return setMessage(t("report.privacyRequired"));}
    if((form.reporterName||form.reporterContact)&&!optionalContactConsent){setBusy(false);return setMessage(t("report.contactConsentRequired"));}
    const data=payload();
    if(!navigator.onLine){queueOffline(data);setBusy(false);return;}
    try{
      const r=await fetch("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
      const j=await r.json().catch(()=>({}));
      setBusy(false);
      if(!r.ok)return setMessage(j.error?.message||t("report.submitFailed"));
      setMessage(t("report.submitted")+" "+j.data.id);
      setForm(x=>({...x,description:""}));
    }catch{
      setBusy(false);queueOffline(data);
    }
  }

  return <form className="card stack" onSubmit={submit}>
    <div><h1>{t("report.title")}</h1><div className="muted">{t("report.subtitle")}</div></div>
    {relatedEntityId&&<div className="resource-report-context"><strong>{t("report.contextTitle")}</strong><span>{relatedName||relatedEntityType} · {t("report.reference")} {relatedEntityId.slice(0,8)}</span></div>}
    {queued>0&&<div className="notice"><strong>{queued} {t("report.offlineWaiting")}</strong></div>}
    <div className="grid two">
      <div className="field"><label>{t("report.type")}</label><select value={form.type} onChange={e=>set("type",e.target.value)}><option value="problem_report">{t("report.problem")}</option><option value="small_river_report">{t("report.stream")}</option></select></div>
      <div className="field"><label>{t("report.nameOptional")}</label><input value={form.reporterName} onChange={e=>set("reporterName",e.target.value)}/></div>
    </div>
    <div className="field"><label>{t("report.contactOptional")}</label><input value={form.reporterContact} onChange={e=>set("reporterContact",e.target.value)} placeholder={t("report.contactPlaceholder")}/></div>
    {(form.reporterName||form.reporterContact)&&<label className="check-field privacy-check"><input type="checkbox" checked={optionalContactConsent} onChange={e=>setOptionalContactConsent(e.target.checked)}/><span>{t("report.optionalConsent")}</span></label>}
    <div className="field"><label>{t("report.description")}</label><textarea required minLength={10} value={form.description} onChange={e=>set("description",e.target.value)} placeholder={t("report.descriptionPlaceholder")}/></div>
    <div className="grid three">
      <div className="field"><label>{t("report.latitude")}</label><input required inputMode="decimal" value={form.latitude} onChange={e=>manualCoordinate("latitude",e.target.value)} placeholder="7.7304"/></div>
      <div className="field"><label>{t("report.longitude")}</label><input required inputMode="decimal" value={form.longitude} onChange={e=>manualCoordinate("longitude",e.target.value)} placeholder="8.5361"/></div>
      <div className="field"><label>{t("report.gpsAccuracy")}</label><input readOnly value={form.gpsAccuracy?("±"+form.gpsAccuracy+" m"):t("report.manualUnknown")}/></div>
    </div>
    <label className="check-field privacy-check"><input type="checkbox" required checked={privacyAcknowledged} onChange={e=>setPrivacyAcknowledged(e.target.checked)}/><span>{t("report.privacyAck")} <Link href="/privacy" target="_blank">[{t("common.privacyNotice")}]</Link></span></label>
    <div className="actions"><button type="button" className="btn" onClick={locate}>{t("report.useGps")}</button><button className="btn primary" disabled={busy||!privacyAcknowledged||Boolean((form.reporterName||form.reporterContact)&&!optionalContactConsent)}>{busy?t("report.submitting"):t("report.submit")}</button></div>
    {message&&<div className={message.startsWith(t("report.submitted"))||message.includes(t("report.reconnectSubmittedSuffix"))?"success":"notice"}>{message}</div>}
  </form>;
}
