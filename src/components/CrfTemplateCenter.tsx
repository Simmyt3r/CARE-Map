"use client";
import {useEffect,useMemo,useState} from "react";
type Field={key:string;label:string;section?:string;required?:boolean;kind?:"text"|"date"|"number"|"textarea"};
type Template={code:string;title:string;manualPage:number;scope:string;fields:Field[];note:string|null};
type RecordRow={
 id:string;template_code:string;community_id:string|null;cig_id:string|null;loan_id:string|null;
 period_month:string|null;field_values:Record<string,string>;signed_original_ref:string|null;
 support_evidence_ref:string|null;status:string;prepared_by:string;reviewed_by:string|null;
 revision:number;created_at:string;review_note:string|null;community_name:string|null;
 cig_name:string|null;loan_reference:string|null
};
type Choice={id:string;label:string};
export default function CrfTemplateCenter({communities,cigs,loans}:{
 communities:Array<{id:string;community_name:string}>;
 cigs:Array<{id:string;cig_name:string}>;
 loans:Array<{id:string;loan_reference:string}>
}){
 const[templates,setTemplates]=useState<Template[]>([]);
 const[records,setRecords]=useState<RecordRow[]>([]);
 const[roles,setRoles]=useState<string[]>([]);
 const[chosen,setChosen]=useState("T14");
 const[recordId,setRecordId]=useState("");
 const[scope,setScope]=useState({communityId:"",cigId:"",loanId:"",periodMonth:""});
 const[values,setValues]=useState<Record<string,string>>({});
 const[signed,setSigned]=useState("");
 const[support,setSupport]=useState("");
 const[reviewNote,setReviewNote]=useState("");
 const[previewNotes,setPreviewNotes]=useState<string[]>([]);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const selected=templates.find(t=>t.code===chosen);
 const record=records.find(r=>r.id===recordId);
 const grouped=useMemo(()=>{
   const sections:{name:string;fields:Field[]}[]=[];
   for(const field of selected?.fields||[]){
     const group=sections.find(s=>s.name===(field.section||"Required fields"));
     if(group)group.fields.push(field);
     else sections.push({name:field.section||"Required fields",fields:[field]});
   }
   return sections;
 },[selected]);
 const mayPrepare=(scope:string)=>{
  if(scope==="registry")return roles.some(r=>["desk_officer","management"].includes(r));
  if(scope==="finance")return roles.some(r=>["finance_officer","desk_officer"].includes(r));
  if(scope==="field")return roles.some(r=>["gis_officer","me_officer","desk_officer"].includes(r));
  return roles.some(r=>["me_officer","management","finance_officer","desk_officer","internal_auditor"].includes(r));
 };
 const mayReview=(scope:string)=>{
  if(scope==="finance")return roles.some(r=>["finance_officer","internal_auditor"].includes(r));
  if(scope==="registry")return roles.some(r=>["management","internal_auditor"].includes(r));
  if(scope==="field")return roles.some(r=>["finance_officer","internal_auditor","management"].includes(r));
  return roles.some(r=>["management","internal_auditor"].includes(r));
 };
 async function reload(){
  setLoading(true);
  try{
   const r=await fetch("/api/crf/templates",{cache:"no-store"});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error?.message||"Form register unavailable. Confirm migration 020.");
   setTemplates(d.data.templates);
   setRecords(d.data.records);
   setRoles(d.roles||[]);
   if(!d.data.templates.some((t:Template)=>t.code===chosen))
    setChosen(d.data.templates[0]?.code||"");
   setMessage("");
  }catch(e){setMessage(e instanceof Error?e.message:"Cannot load standard form register.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void reload();},[]);
 function openRecord(id:string){
  setRecordId(id);
  const r=records.find(v=>v.id===id);
  if(!r)return;
  setChosen(r.template_code);
  setScope({communityId:r.community_id||"",cigId:r.cig_id||"",loanId:r.loan_id||"",
   periodMonth:r.period_month?String(r.period_month).slice(0,7):""});
  setValues(r.field_values||{});
  setSigned(r.signed_original_ref||"");
  setSupport(r.support_evidence_ref||"");
 }
 function fresh(code=chosen){
  setChosen(code);setRecordId("");setValues({});setSigned("");setSupport("");
  setScope({communityId:"",cigId:"",loanId:"",periodMonth:""});
 }
 async function send(payload:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/crf/templates",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(payload)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"Form record could not be saved.");
   await reload();
   if(j.id)setRecordId(String(j.id));
   setMessage("Form "+j.status+". This record does not authorize payment or replace the signed original.");
  }catch(e){setMessage(e instanceof Error?e.message:"Form operation failed.");}
  finally{setBusy(false);}
 }
 function doSave(){
  if(recordId){
   void send({action:"update",recordId,values,signedOriginalRef:signed||null,supportEvidenceRef:support||null});
  }else{
   void send({action:"create",templateCode:chosen,
    communityId:scope.communityId||null,cigId:scope.cigId||null,
    loanId:scope.loanId||null,
    periodMonth:scope.periodMonth?scope.periodMonth+"-01":null,
    values,signedOriginalRef:signed||null,supportEvidenceRef:support||null});
  }
 }
 async function prefillT14(){
  if(!scope.communityId||!scope.periodMonth){setMessage("Choose a community and reporting month first.");return;}
  if(Object.values(values).some(Boolean)&&!confirm("Replace existing draft fields with verified CARE-Map figures? Unsupported T14 fields will remain unchanged."))return;
  setBusy(true);
  try{
   const qs=new URLSearchParams({communityId:scope.communityId,month:scope.periodMonth});
   const r=await fetch("/api/crf/templates/t14-preview?"+qs,{cache:"no-store"});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"T14 preview unavailable.");
   if(!j.data.hasVerifiedEntries)throw Error("No verified disbursements exist for this community. Reconcile the source ledger before T14 prefill.");
   setValues(v=>({...v,...j.data.values}));
   setPreviewNotes(j.data.missing||[]);
   setMessage("Pre-filled from recorded and verified entries. Examine bank statements and sign the official T14 before submitting.");
  }catch(e){setMessage(e instanceof Error?e.message:"Cannot prefill T14.");}
  finally{setBusy(false);}
 }
 function viewSheet(){
  window.print();
 }
 const options=(items:Choice[],placeholder:string)=><><option value="">{placeholder}</option>
  {items.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</>;
 return <div className="stack">
  <div className="section-head"><div><span className="page-eyebrow">Part Four · Revised CRF Operations Manual</span>
    <h2>Mandatory CRF templates (T1–T19)</h2>
    <p className="muted">Register the actual official forms, supporting evidence and independent reviews. T12A–D and T15A–E remain separate distinct documents.</p>
   </div><button type="button" className="btn" disabled={loading} onClick={()=>void reload()}>Refresh</button>
  </div>
  <div className="notice"><strong>Source document controls:</strong> States may translate but must not change the substance of the Manual&apos;s forms. These editable fields are an internal indexing companion, <strong>not</strong> recreated official forms. Keep the original completed, signed PDF/paper in approved SPMU storage. Enter its reference here, not sensitive NINs, phone numbers, account numbers or signatures. The source PDF still identifies its document-control status as a draft for review; confirm the adopted edition with FPMU.</div>
  {loading&&<p role="status">Loading authorized CRF form records…</p>}
  {message&&<div className="notice" role="status">{message}</div>}
  {!!templates.length&&<div className="grid two">
   <div className="card stack">
    <h3>Choose the source form</h3>
    <div className="field"><label htmlFor="crf-template-code">Manual form</label>
     <select id="crf-template-code" value={chosen} onChange={e=>fresh(e.target.value)}>
      {templates.map(t=><option key={t.code} value={t.code}>{t.code} · {t.title}</option>)}
     </select></div>
    <div><strong>{selected?.title}</strong><p className="muted">Manual page {selected?.manualPage} · {selected?.scope} records</p></div>
    {selected?.note&&<p className="notice">{selected.note}</p>}
    <div className="field"><label htmlFor="crf-existing-form">Open existing filing</label>
     <select id="crf-existing-form" value={recordId} onChange={e=>e.target.value?openRecord(e.target.value):fresh()}>
      <option value="">Start a new filing</option>
      {records.filter(r=>r.template_code===chosen).map(r=><option key={r.id} value={r.id}>
       {r.community_name||r.cig_name||r.loan_reference||"State register"} · {r.status} · {String(r.created_at).slice(0,10)}
      </option>)}
     </select></div>
    <p className="muted">{records.filter(r=>r.template_code===chosen).length} recent filings of this type. Filing status is a document-review state, not CRF financial authorization.</p>
   </div>
   <div className="card stack">
    <h3>Link to Benue&apos;s official CRF records</h3>
    {([["communityId","Community",communities.map(c=>({id:c.id,label:c.community_name}))],
       ["cigId","CIG",cigs.map(c=>({id:c.id,label:c.cig_name}))],
       ["loanId","Loan",loans.map(l=>({id:l.id,label:l.loan_reference}))]] as [keyof typeof scope,string,Choice[]][]).map(([key,label,choices])=>
     <div className="field" key={key}><label htmlFor={"crf-scope-"+key}>{label}</label>
      <select id={"crf-scope-"+key} disabled={!!recordId} value={scope[key]}
       onChange={e=>setScope(v=>({...v,[key]:e.target.value}))}>
       {options(choices,"Not linked")}</select></div>)}
    <div className="field"><label htmlFor="crf-filing-period">Reporting period (monthly forms)</label>
     <input id="crf-filing-period" type="month" disabled={!!recordId} value={scope.periodMonth}
      onChange={e=>setScope(v=>({...v,periodMonth:e.target.value}))}/></div>
   </div>
  </div>}
  {selected&&<section className="card stack crf-source-form">
   <div className="section-head">
    <div><strong>{selected.code} · {selected.title}</strong>
     <p className="muted">Manual p. {selected.manualPage} · Filing {record?.status||"new draft"} · Revision {record?.revision||"1"}</p></div>
    <button type="button" className="btn no-print" onClick={viewSheet}>Print companion view</button>
   </div>
   {selected.code==="T14"&&(!record||["draft","returned"].includes(record.status))&&<div className="stack no-print">
    <div className="actions"><button className="btn" type="button" disabled={busy||!scope.communityId||!scope.periodMonth} onClick={()=>void prefillT14()}>Prefill verified T14 figures</button></div>
    {previewNotes.length>0&&<div className="notice"><strong>Not calculated from source records:</strong><ul>{previewNotes.map(p=><li key={p}>{p}</li>)}</ul></div>}
   </div>}
   {grouped.map(section=><fieldset key={section.name} className="crf-form-section">
    <legend>{section.name}</legend>
    <div className="grid two">
    {section.fields.map(field=><div className="field" key={field.key}>
     <label htmlFor={"crf-form-"+field.key}>{field.label}{field.required?" *":""}</label>
     {field.kind==="textarea"?
       <textarea id={"crf-form-"+field.key} rows={3} disabled={!!record&&!["draft","returned"].includes(record.status)}
        value={values[field.key]||""} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>:
       <input id={"crf-form-"+field.key} type={field.kind||"text"} maxLength={2800}
        disabled={!!record&&!["draft","returned"].includes(record.status)} value={values[field.key]||""}
        onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>}
     </div>)}
    </div>
   </fieldset>)}
   <div className="grid two">
    <div className="field"><label htmlFor="crf-form-original">Signed official form · controlled-storage reference *</label>
     <input id="crf-form-original" value={signed} disabled={!!record&&!["draft","returned"].includes(record.status)} maxLength={350}
      placeholder="SPMU-controlled file reference (not a public URL)"
      onChange={e=>setSigned(e.target.value)}/></div>
    <div className="field"><label htmlFor="crf-form-evidence">Supporting evidence folder/reference</label>
     <input id="crf-form-evidence" value={support} disabled={!!record&&!["draft","returned"].includes(record.status)} maxLength={350}
      onChange={e=>setSupport(e.target.value)}/></div>
   </div>
   <div className="actions no-print">
    {mayPrepare(selected.scope)&&(!record||["draft","returned"].includes(record.status))&&
     <button type="button" className="btn primary" disabled={busy} onClick={doSave}>
      {record?"Save draft revision":"Create form filing"}</button>}
    {record?.status==="draft"&&mayPrepare(selected.scope)&&
     <button type="button" className="btn" disabled={busy||!signed}
      onClick={()=>void send({action:"submit",recordId})}>Submit for independent verification</button>}
    {record?.status==="submitted"&&mayReview(selected.scope)&&
      <div className="stack">
       <div className="field"><label>Independent reviewer note</label><textarea value={reviewNote}
        onChange={e=>setReviewNote(e.target.value)} placeholder="Evidence checked, discrepancies and follow-up"/></div>
       <div className="actions">
        <button type="button" className="btn primary" disabled={busy||!reviewNote.trim()}
         onClick={()=>void send({action:"review",recordId,decision:"verified",reviewNote})}>Verify filed original</button>
        <button type="button" className="btn" disabled={busy||!reviewNote.trim()}
         onClick={()=>void send({action:"review",recordId,decision:"returned",reviewNote})}>Return with reasons</button>
       </div>
      </div>}
   </div>
   {record?.review_note&&<div className="notice">Review: {record.review_note}</div>}
   <p className="muted">No digital entry here supplies a signature, approves a loan, creates a T15 bank mandate, executes a payment or supersedes the original numbered Manual form.</p>
  </section>}
  {!!records.length&&<section className="card stack">
   <h3>Recent form filings</h3>
   <div className="table-wrap"><table>
    <thead><tr><th>Template</th><th>Linked record</th><th>Status</th><th>Filed</th><th>Review</th></tr></thead>
    <tbody>{records.slice(0,60).map(r=><tr key={r.id}>
     <td><button type="button" className="btn" onClick={()=>openRecord(r.id)}>{r.template_code}</button></td>
     <td>{r.community_name||r.cig_name||r.loan_reference||"State"}</td>
     <td>{r.status}</td><td>{String(r.created_at).slice(0,10)}</td>
     <td>{r.review_note||"—"}</td>
    </tr>)}</tbody></table></div>
  </section>}
 </div>;
}
