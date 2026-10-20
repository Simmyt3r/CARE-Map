"use client";
import {useEffect,useState} from "react";
type LgaCommunity={id:string;community_name:string;lga_code:string};
type Cig={id:string;cig_name:string;community_name:string;community_id:string};
type FieldData={
 inspections:Array<{id:string;cig_name:string;community_name:string;inspected_on:string;
  activity_verified:boolean;findings_status:string;notes:string}>;
 assets:Array<{id:string;cig_name:string;asset_reference:string;asset_description:string;verified_status:string}>;
 actions:Array<{id:string;community_name:string;finding_type:string;severity:string;
  due_on:string;status:string;finding_detail:string}>;
};
const today=new Date().toISOString().slice(0,10);
export default function CrfFieldCenter({cigs,communities,roles}:{
 cigs:Cig[];communities:LgaCommunity[];roles:string[];
}){
 const[data,setData]=useState<FieldData>({inspections:[],assets:[],actions:[]});
 const[message,setMessage]=useState("");
 const[busy,setBusy]=useState(false);
 const[form,setForm]=useState({cigId:"",inspectedOn:today,notes:"",
  activityVerified:false,evidenceRef:"",latitude:"",longitude:"",gpsAccuracyM:""});
 const[asset,setAsset]=useState({cigId:"",assetReference:"",assetDescription:"",amountNgn:"",
  evidenceRef:""});
 const[action,setAction]=useState({communityId:"",findingType:"",findingDetail:"",
  severity:"medium",dueOn:today});
 const[closureEvidence,setClosureEvidence]=useState("");
 const canField=roles.some(r=>["gis_officer","me_officer","desk_officer"].includes(r));
 const canVerify=roles.some(r=>["finance_officer","internal_auditor"].includes(r));
 async function reload(){
  try{const r=await fetch("/api/crf/field",{cache:"no-store"});
   const d=await r.json();
   if(!r.ok)throw Error(d.error?.message||"Field records unavailable.");
   setData(d.data);
  }catch(e){setMessage(e instanceof Error?e.message:"Could not load CRF field records.");}
 }
 useEffect(()=>{void reload();},[]);
 async function post(payload:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/crf/field",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(payload)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"Field action was rejected.");
   await reload();setMessage("Field evidence recorded. Independent review is required where applicable.");
  }catch(e){setMessage(e instanceof Error?e.message:"CRF field action failed.");}
  finally{setBusy(false);}
 }
 return <div className="stack">
  <div className="notice">CRF field evidence is private to authorized SPMU personnel. This is an online recording workflow; offline capture and secure synchronization require a separate field-tested release.</div>
  {message&&<div className="notice" role="status">{message}</div>}
  {canField&&<div className="grid two">
   <form className="card stack" onSubmit={e=>{e.preventDefault();void post({
    action:"inspection",cigId:form.cigId,inspectedOn:form.inspectedOn,
    activityVerified:form.activityVerified,notes:form.notes,
    ...(form.evidenceRef?{evidenceRef:form.evidenceRef}:{}),
    ...(form.latitude&&form.longitude?{latitude:Number(form.latitude),longitude:Number(form.longitude),
      gpsAccuracyM:form.gpsAccuracyM?Number(form.gpsAccuracyM):null}:{})
   });}}>
    <h3>Record a field inspection</h3>
    <div className="field"><label>CIG</label><select required value={form.cigId}
     onChange={e=>setForm(v=>({...v,cigId:e.target.value}))}>
     <option value="">Select CIG</option>{cigs.map(c=><option key={c.id} value={c.id}>{c.cig_name} · {c.community_name}</option>)}
    </select></div>
    <div className="field"><label>Inspection date</label><input required type="date" value={form.inspectedOn}
     onChange={e=>setForm(v=>({...v,inspectedOn:e.target.value}))}/></div>
    <div className="field"><label>Observations</label><textarea required minLength={5} value={form.notes}
     onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></div>
    <label><input type="checkbox" checked={form.activityVerified}
     onChange={e=>setForm(v=>({...v,activityVerified:e.target.checked}))}/> Agricultural enterprise operating as described</label>
    <div className="field"><label>Approved evidence reference</label><input value={form.evidenceRef}
     onChange={e=>setForm(v=>({...v,evidenceRef:e.target.value}))}/></div>
    <div className="grid three">
     {(["latitude","longitude","gpsAccuracyM"] as const).map(key=><div className="field" key={key}>
       <label>{key==="latitude"?"Latitude":key==="longitude"?"Longitude":"GPS accuracy (m)"}</label>
       <input type="number" step="any" value={form[key]}
        onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>
      </div>)}
    </div>
    <button className="btn primary" disabled={busy} type="submit">Submit inspection for review</button>
   </form>
   <form className="card stack" onSubmit={e=>{e.preventDefault();void post({
    action:"asset",cigId:asset.cigId,assetReference:asset.assetReference,
    assetDescription:asset.assetDescription,...(asset.amountNgn?{amountNgn:Number(asset.amountNgn)}:{}),
    ...(asset.evidenceRef?{evidenceRef:asset.evidenceRef}:{})
   });}}>
    <h3>Register a durable CIG asset (T17)</h3>
    <div className="field"><label>CIG</label><select required value={asset.cigId}
     onChange={e=>setAsset(v=>({...v,cigId:e.target.value}))}>
     <option value="">Select CIG</option>{cigs.map(c=><option key={c.id} value={c.id}>{c.cig_name}</option>)}
    </select></div>
    <div className="field"><label>Asset register reference</label><input required value={asset.assetReference}
     onChange={e=>setAsset(v=>({...v,assetReference:e.target.value}))}/></div>
    <div className="field"><label>Asset description</label><textarea required value={asset.assetDescription}
     onChange={e=>setAsset(v=>({...v,assetDescription:e.target.value}))}/></div>
    <div className="field"><label>Documented value (₦), optional</label><input type="number" min={0} step=".01" value={asset.amountNgn}
     onChange={e=>setAsset(v=>({...v,amountNgn:e.target.value}))}/></div>
    <div className="field"><label>Approved evidence reference</label><input value={asset.evidenceRef}
     onChange={e=>setAsset(v=>({...v,evidenceRef:e.target.value}))}/></div>
    <button className="btn primary" type="submit" disabled={busy}>Add to asset register</button>
   </form>
  </div>}
  {canField&&<form className="card stack" onSubmit={e=>{e.preventDefault();void post({
    action:"corrective_action",communityId:action.communityId,findingType:action.findingType,
    findingDetail:action.findingDetail,severity:action.severity,dueOn:action.dueOn
   });}}>
   <h3>Open corrective action (T16)</h3>
   <div className="grid three">
    <div className="field"><label>Community</label><select required value={action.communityId}
      onChange={e=>setAction(v=>({...v,communityId:e.target.value}))}>
      <option value="">Choose community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.community_name}</option>)}
     </select></div>
    <div className="field"><label>Finding type</label><input required value={action.findingType}
      onChange={e=>setAction(v=>({...v,findingType:e.target.value}))}/></div>
    <div className="field"><label>Severity</label><select value={action.severity}
      onChange={e=>setAction(v=>({...v,severity:e.target.value}))}>
      {["low","medium","high","critical"].map(x=><option value={x} key={x}>{x}</option>)}
     </select></div>
    <div className="field"><label>Action deadline</label><input required type="date" value={action.dueOn}
      onChange={e=>setAction(v=>({...v,dueOn:e.target.value}))}/></div>
   </div>
   <div className="field"><label>Evidence-based finding and required correction</label>
    <textarea required value={action.findingDetail}
     onChange={e=>setAction(v=>({...v,findingDetail:e.target.value}))}/></div>
   <button className="btn primary" disabled={busy} type="submit">Record corrective action</button>
  </form>}
  <section className="card stack"><h3>Inspection history</h3>
   <div className="table-wrap"><table><thead><tr><th>CIG</th><th>Date</th><th>Activity observed</th><th>Review</th></tr></thead>
    <tbody>{data.inspections.map(i=><tr key={i.id}><td>{i.cig_name}</td><td>{String(i.inspected_on).slice(0,10)}</td>
     <td>{i.activity_verified?"Yes, awaiting/with review":"Not confirmed"}</td>
     <td>{i.findings_status}
      {canVerify&&i.findings_status==="pending_review"&&
       <button className="btn" type="button" disabled={busy}
        onClick={()=>void post({action:"verify_inspection",inspectionId:i.id,decision:"verified"})}>Verify</button>}</td>
     </tr>)}</tbody></table></div>
  </section>
  <section className="card stack"><h3>Durable assets pending review</h3>
   <div className="table-wrap"><table><thead><tr><th>Group</th><th>Asset</th><th>Reference</th><th>State</th></tr></thead>
   <tbody>{data.assets.map(a=><tr key={a.id}><td>{a.cig_name}</td><td>{a.asset_description}</td>
    <td>{a.asset_reference}</td><td>{a.verified_status}</td></tr>)}</tbody></table></div>
  </section>
  <section className="card stack"><h3>Corrective-action log</h3>
   <div className="field"><label>Verified closure evidence reference</label><input value={closureEvidence}
     onChange={e=>setClosureEvidence(e.target.value)} placeholder="T16 closure evidence reference"/></div>
   <div className="table-wrap"><table><thead><tr><th>Community</th><th>Finding</th><th>Severity</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>{data.actions.map(a=><tr key={a.id}><td>{a.community_name}</td><td>{a.finding_detail}</td>
     <td>{a.severity}</td><td>{String(a.due_on).slice(0,10)}</td><td>{a.status}</td><td>
     {canField&&["open","in_progress"].includes(a.status)&&<button className="btn" disabled={busy||closureEvidence.trim().length<3}
      onClick={()=>void post({action:"close_action",actionId:a.id,evidenceRef:closureEvidence})}>Submit closure</button>}
     {canVerify&&a.status==="resolved"&&<button className="btn" disabled={busy}
      onClick={()=>void post({action:"verify_action_closure",actionId:a.id})}>Verify closure</button>}
     </td></tr>)}</tbody></table></div>
  </section>
 </div>;
}
