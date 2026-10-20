"use client";
import {useEffect,useState} from "react";
type Loan={id:string;loan_reference:string;principal_ngn:string;service_charge_ngn:string};
type Schedule={instalment_no:number;due_date:string;principal_due_ngn:string;service_charge_due_ngn:string};
type MoneyEntry={id:string;bank_reference:string;verification:string;tranche?:number;
 amount_ngn?:string;principal_ngn?:string;paid_at?:string};
const today=new Date().toISOString().slice(0,10);
export default function CrfLedgerWorkflow({loans,roles}:{
 loans:Loan[];roles:string[];
}){
 const [loanId,setLoanId]=useState("");
 const [detail,setDetail]=useState<{schedule:Schedule[];disbursements:MoneyEntry[];
  repayments:MoneyEntry[]}|null>(null);
 const [instalments,setInstalments]=useState([
   {dueDate:"",principalDueNgn:"",serviceChargeDueNgn:"0"},
   {dueDate:"",principalDueNgn:"",serviceChargeDueNgn:"0"},
   {dueDate:"",principalDueNgn:"",serviceChargeDueNgn:"0"}
 ]);
 const [tranche,setTranche]=useState<1|2>(1);
 const [payment,setPayment]=useState({transferDate:today,bankReference:"",t15EndorsementRef:"",
  evidenceRef:"",loanAppReference:"",firstTrancheUseRef:""});
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const canRecord=roles.some(r=>["finance_officer","desk_officer"].includes(r));
 const canVerify=roles.some(r=>["finance_officer","internal_auditor"].includes(r));
 const chosen=loans.find(l=>l.id===loanId);
 const number=(v:string)=>Number(v);
 const fmt=(v:unknown)=>"₦"+Number(v).toLocaleString("en-NG",{maximumFractionDigits:2});
 async function refresh(id=loanId){
  if(!id){setDetail(null);return;}
  try{
   const r=await fetch("/api/crf/ledger?loanId="+id,{cache:"no-store"});
   const j=await r.json();
   if(!r.ok)throw Error(j.error?.message||"Cannot load loan file.");
   setDetail(j.data);
  }catch(e){setMessage(e instanceof Error?e.message:"Loan record unavailable.");}
 }
 useEffect(()=>{if(loans.length&& !loanId)setLoanId(loans[0].id);},[loans,loanId]);
 useEffect(()=>{void refresh();},[loanId]);
 async function post(payload:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/crf/ledger",{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"Financial monitoring entry was rejected.");
   await refresh();
   setMessage("Record saved. Only independently reconciled transactions affect the SPMU recovery indicators.");
  }catch(e){setMessage(e instanceof Error?e.message:"Could not save the record.");}
  finally{setBusy(false);}
 }
 const principal=number(chosen?.principal_ngn||"0");
 const first=Math.round(principal*70)/100;
 const expected=tranche===1?first:Math.round((principal-first)*100)/100;
 const scheduledPrincipal=instalments.reduce((sum,i)=>sum+Number(i.principalDueNgn||0),0);
 const scheduledCharge=instalments.reduce((sum,i)=>sum+Number(i.serviceChargeDueNgn||0),0);
 return <section className="card stack">
  <div className="section-head"><div><h3>Loan schedule, tranche and bank-evidence verification</h3>
    <p className="muted">For external bank transactions only. This screen cannot transfer or approve funds.</p></div></div>
  <div className="field"><label htmlFor="crf-loan-details">Loan file</label>
    <select id="crf-loan-details" value={loanId} onChange={e=>setLoanId(e.target.value)}>
      <option value="">Choose a loan</option>{loans.map(l=><option key={l.id} value={l.id}>{l.loan_reference}</option>)}
    </select></div>
  {message&&<div className="notice" role="status">{message}</div>}
  {chosen&&<>
   <div className="resource-facts">
    <div><span>Principal</span><strong>{fmt(chosen.principal_ngn)}</strong></div>
    <div><span>Flat service charge</span><strong>{fmt(chosen.service_charge_ngn)}</strong></div>
    <div><span>Total schedule obligation</span><strong>{fmt(principal+number(chosen.service_charge_ngn))}</strong></div>
   </div>
   {canRecord&&<form className="stack" onSubmit={e=>{e.preventDefault();void post({
     action:"schedule",loanId,instalments:instalments.map(v=>({
      dueDate:v.dueDate,principalDueNgn:number(v.principalDueNgn),
      serviceChargeDueNgn:number(v.serviceChargeDueNgn)
     }))
   });}}>
    <h4>Record the signed repayment schedule (T10)</h4>
    <p className="muted">Enter the instalments exactly as signed. Principal must total the loan amount. The flat service charge is due with the final instalment.</p>
    {instalments.map((v,i)=><div className="grid three" key={i}>
     <div className="field"><label>Instalment {i+1}: due date</label>
      <input required type="date" value={v.dueDate}
       onChange={e=>setInstalments(a=>a.map((x,k)=>k===i?{...x,dueDate:e.target.value}:x))}/></div>
     <div className="field"><label>Principal due (₦)</label>
      <input required type="number" min={0} step=".01" value={v.principalDueNgn}
       onChange={e=>setInstalments(a=>a.map((x,k)=>k===i?{...x,principalDueNgn:e.target.value}:x))}/></div>
     <div className="field"><label>Service charge (₦)</label>
      <input required type="number" min={0} step=".01" value={v.serviceChargeDueNgn}
       onChange={e=>setInstalments(a=>a.map((x,k)=>k===i?{...x,serviceChargeDueNgn:e.target.value}:x))}/></div>
    </div>)}
    <p className="muted">Entered totals: {fmt(scheduledPrincipal)} principal + {fmt(scheduledCharge)} charge.</p>
    <div className="actions"><button type="button" className="btn"
      onClick={()=>setInstalments(a=>[...a,{dueDate:"",principalDueNgn:"",serviceChargeDueNgn:"0"}])}
      disabled={instalments.length>=24}>Add instalment</button>
     <button type="button" className="btn" disabled={instalments.length<=1}
      onClick={()=>setInstalments(a=>a.slice(0,-1))}>Remove last</button>
     <button type="submit" className="btn primary" disabled={busy||detail?.disbursements?.length!==0}>
      Save signed schedule</button>
    </div>
   </form>}
   {canRecord&&<form className="stack" onSubmit={e=>{e.preventDefault();void post({
     action:"record_disbursement",loanId,tranche,amountNgn:expected,
     transferDate:payment.transferDate,bankReference:payment.bankReference,
     t15EndorsementRef:payment.t15EndorsementRef,evidenceRef:payment.evidenceRef,
     loanAppReference:payment.loanAppReference,
     ...(tranche===2?{firstTrancheUseRef:payment.firstTrancheUseRef}:{})
   });}}>
    <h4>Register a bank-confirmed disbursement (T11/T12A/T15C)</h4>
    <div className="grid three">
     <div className="field"><label>Tranche</label><select value={tranche}
       onChange={e=>setTranche(Number(e.target.value) as 1|2)}>
       <option value={1}>First, 70%</option><option value={2}>Second, 30%</option></select></div>
     <div className="field"><label>Expected amount</label><strong>{fmt(expected)}</strong></div>
     <div className="field"><label>Bank transfer date</label><input required type="date" value={payment.transferDate}
       onChange={e=>setPayment(v=>({...v,transferDate:e.target.value}))}/></div>
     {([["bankReference","Bank statement transfer reference"],
       ["t15EndorsementRef","Endorsed T15C instruction"],
       ["evidenceRef","Bank evidence reference"],
       ["loanAppReference","Official CRF Loan App entry reference"]] as const).map(([key,label])=>
       <div className="field" key={key}><label>{label}</label><input required
        value={payment[key]} onChange={e=>setPayment(v=>({...v,[key]:e.target.value}))}/></div>)}
     {tranche===2&&<div className="field"><label>CBA first-tranche use verification reference</label><input required
       value={payment.firstTrancheUseRef}
       onChange={e=>setPayment(v=>({...v,firstTrancheUseRef:e.target.value}))}/></div>}
    </div>
    <button type="submit" disabled={busy||!detail?.schedule.length} className="btn primary">
     Record external transfer for reconciliation</button>
   </form>}
   <div className="stack">
    <h4>Recorded disbursements</h4>
    <div className="table-wrap"><table><thead><tr><th>Tranche</th><th>Bank reference</th><th>Amount</th><th>Review</th></tr></thead>
     <tbody>{detail?.disbursements.map(d=><tr key={d.id}><td>{d.tranche}</td>
      <td>{d.bank_reference}</td><td>{fmt(d.amount_ngn)}</td><td>{d.verification}
       {canVerify&&d.verification==="pending"&&<button className="btn" type="button" disabled={busy}
        onClick={()=>void post({action:"verify_disbursement",entryId:d.id,decision:"verified"})}>Verify</button>}</td>
      </tr>)}</tbody></table></div>
   </div>
   <div className="stack">
    <h4>Recorded repayments</h4>
    <div className="table-wrap"><table><thead><tr><th>Bank reference</th><th>Principal</th><th>Review</th></tr></thead>
     <tbody>{detail?.repayments.map(r=><tr key={r.id}><td>{r.bank_reference}</td>
      <td>{fmt(r.principal_ngn)}</td><td>{r.verification}
       {canVerify&&r.verification==="pending"&&<button className="btn" type="button" disabled={busy}
        onClick={()=>void post({action:"verify_repayment",entryId:r.id,decision:"verified"})}>Verify</button>}</td>
      </tr>)}</tbody></table></div>
   </div>
  </>}
 </section>;
}
