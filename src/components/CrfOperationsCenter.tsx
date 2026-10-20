"use client";
import {useCallback,useEffect,useState} from "react";
import CrfFieldCenter from "@/components/CrfFieldCenter";
import CrfLedgerWorkflow from "@/components/CrfLedgerWorkflow";
type Lga={code:string;name:string};
type Community={id:string;community_code:string;community_name:string;lga_code:string;status:string;bank_controls_documented:boolean};
type Cig={id:string;cig_code:string;cig_name:string;community_name:string;community_id:string;
 qualification:string;member_count:number;female_count:number;verified_count:number;women_led:boolean};
type Loan={id:string;loan_reference:string;cig_name:string;community_name:string;lga_code:string;
 principal_ngn:string;approved_ceiling_ngn:string;service_charge_ngn:string;tenor_months:number;
 disbursed_ngn:string;principal_repaid_ngn:string;due_to_date_ngn:string};
type Summary={scope:{month:string;lga:string};counts:Record<string,number>;
 indicators:{recoveryPercent:number|null;par60Percent:number|null;womenFundPercent:number|null;
 amounts:{dueInPeriod:number;recoveredInPeriod:number;outstandingTotal:number;outstandingAtRisk60:number;
 verifiedDisbursedTotal:number;womenLedDisbursed:number}};
 alerts:{recoveryLow:boolean;par60High:boolean;womenFundLow:boolean};lgas:Lga[];limitations:string[]};
type Staff={id:string;name:string;email:string};
const roleOptions=[
 ["desk_officer","CRF Desk Officer"],["me_officer","M&E Officer"],["gis_officer","GIS Officer"],
 ["finance_officer","Financial Management"],["internal_auditor","Internal Auditor"],["management","SPMU Management"]
];
function format(v:unknown){const n=Number(v);return Number.isFinite(n)?"₦"+n.toLocaleString("en-NG",{maximumFractionDigits:2}):"—";}
function percent(v:number|null){return v===null?"N/A":v.toFixed(1)+"%";}
const simpleDate=new Date().toISOString().slice(0,10);
export default function CrfOperationsCenter({admin,initialAccess}:{
 admin:boolean;initialAccess:boolean;
}){
 const[tab,setTab]=useState<"overview"|"registry"|"finance"|"field"|"access">("overview");
 const[overview,setOverview]=useState<Summary|null>(null);
 const[communities,setCommunities]=useState<Community[]>([]);
 const[cigs,setCigs]=useState<Cig[]>([]);
 const[members,setMembers]=useState<Array<{id:string;cig_id:string;member_reference:string;sex:string;
   participation_verified:boolean;recorded_by:string}>>([]);
 const[memberVerificationRef,setMemberVerificationRef]=useState("");
 const[communityChecks,setCommunityChecks]=useState({
  communityId:"",approvalReference:"",bankMandateRef:"",account1EvidenceRef:"",
  account2EvidenceRef:"",spmuEndorsementRef:""
 });
 const[loans,setLoans]=useState<Loan[]>([]);
 const[users,setUsers]=useState<Staff[]>([]);
 const[assignments,setAssignments]=useState<Array<{user_id:string;name:string;crf_role:string}>>([]);
 const[roles,setRoles]=useState<string[]>([]);
 const[loading,setLoading]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState("");
 const[month,setMonth]=useState(simpleDate.slice(0,7));
 const[lga,setLga]=useState("");
 const[record,setRecord]=useState({communityCode:"",communityName:"",lgaCode:"",cigCode:"",
  cigName:"",enterpriseType:"",savingsNgn:"0",womenLed:false,communityId:"",
  cigId:"",memberReference:"",sex:"female",qualificationRef:""});
 const[loan,setLoan]=useState({cigId:"",loanReference:"",cycle:"1",principalNgn:"",
  approvedCeilingNgn:"",cbnRateReference:"",tenorMonths:"6",approvalMemoRef:"",
  approvalDate:simpleDate,agreementRef:""});
 const[entry,setEntry]=useState({loanId:"",kind:"record_repayment",bankReference:"",
  bankEvidenceRef:"",amountNgn:"",principalNgn:"",serviceChargeNgn:"0",
  defaultFeeNgn:"0",t15EndorsementRef:"",evidenceRef:"",loanAppReference:"",
  firstTrancheUseRef:"",tranche:"1",paidAt:simpleDate,transferDate:simpleDate});
 const[roleForm,setRoleForm]=useState({userId:"",role:"desk_officer"});
 const canRegistry=roles.some(r=>["desk_officer","management"].includes(r));
 const canFinance=roles.some(r=>["desk_officer","finance_officer"].includes(r));
 const canVerify=roles.some(r=>["finance_officer","internal_auditor"].includes(r));
 const canReport=roles.some(r=>["desk_officer","finance_officer","internal_auditor","me_officer","management"].includes(r));
 async function read(path:string){
  const r=await fetch(path,{cache:"no-store"});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error?.message||"The CRF service is unavailable.");
  return j;
 }
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   if(admin){
    const a=await read("/api/crf/access");
    setUsers(a.data.users);setAssignments(a.data.roles);
   }
   if(initialAccess){
    const [reg,fin,sum]=await Promise.all([
     read("/api/crf/registry"),read("/api/crf/ledger"),
     read("/api/crf/overview?month="+month+"&lga="+encodeURIComponent(lga))
    ].map(p=>p.catch(e=>({failed:String(e)}))));
    if("failed" in reg)throw Error(reg.failed);
    setCommunities(reg.data.communities);setCigs(reg.data.cigs);setMembers(reg.data.members||[]);
    setRoles(reg.roles||[]);
    if(!("failed" in fin))setLoans(fin.data.loans);
    if(!("failed" in sum))setOverview(sum);
   }
   setMessage("");
  }catch(e){setMessage(e instanceof Error?e.message:"Could not load the CRF workspace.");}
  finally{setLoading(false);}
 },[admin,initialAccess,lga,month]);
 useEffect(()=>{void refresh();},[refresh]);
 async function send(url:string,payload:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify(payload)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error?.message||"The operation was not accepted.");
   await refresh();
   setMessage("Recorded successfully. Entries requiring independent review are not counted until verified.");
  }catch(e){setMessage(e instanceof Error?e.message:"Request failed.");}
  finally{setBusy(false);}
 }
 const numeric=(v:string)=>Number(v);
 return <div className="stack">
  <div className="section-head">
   <div><span className="page-eyebrow">Benue SPMU · Private working environment</span>
    <h1>CRF Monitoring & Accountability</h1>
    <p className="muted">Community and CIG registry, evidenced loan monitoring, GIS-linked inspections and management reporting.</p></div>
   <span className="badge">Monitoring only · No bank transfers</span>
  </div>
  <div className="notice">
   <strong>Source and responsibility:</strong> Based on the revised CRF Operations Manual for AF.
   This module records external approvals and verified bank evidence. It does not replace the official CRF Loan App,
   authorize disbursement or imply that the SPMU has approved any example records. All figures come from existing verified records.
  </div>
  <div className="staff-tabs" role="group" aria-label="CRF workspace sections">
   {(["overview","registry","finance","field",...(admin?["access" as const]:[])] as const).map(t=>
    <button key={t} className={"btn"+(tab===t?" primary":"")} type="button"
      aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==="overview"?"Command dashboard":
       t==="registry"?"Communities & CIGs":t==="finance"?"Loans & recovery":t==="field"?"Inspections & T16/T17":"Role assignments"}</button>)}
  </div>
  {loading&&<p className="muted" role="status">Checking authenticated CRF records…</p>}
  {message&&<div className="notice" role="status">{message}</div>}
  {!initialAccess&&tab!=="access"&&<div className="card stack">
   <strong>Restricted CRF data</strong>
   <p>An administrator must grant your staff account an explicit CRF duty role before confidential
   beneficiary or financial information can be displayed. Ordinary GIS staff permissions do not grant financial access.</p>
   {admin&&<button className="btn" type="button" onClick={()=>setTab("access")}>Configure CRF roles</button>}
  </div>}
  {initialAccess&&tab==="overview"&&<div className="stack">
   <div className="card filters">
    <div className="field"><label htmlFor="crf-month">Report period</label><input id="crf-month" type="month" value={month}
     onChange={e=>setMonth(e.target.value)}/></div>
    <div className="field"><label htmlFor="crf-lga">LGA</label>
     <select id="crf-lga" value={lga} onChange={e=>setLga(e.target.value)}>
      <option value="">All Benue LGAs</option>{overview?.lgas.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}
     </select></div>
    <div className="field"><label>Reporting</label><strong>Community T14: 7th</strong></div>
    <div className="field"><label>Submission</label><strong>SPMU report & T16: 12th</strong></div>
   </div>
   {overview&&canReport&&<>
    <div className="stats">
     <div className="stat"><span>Registered CIGs</span><strong>{overview.counts.cigs}</strong></div>
     <div className="stat"><span>Verified value disbursed</span><strong>{format(overview.indicators.amounts.verifiedDisbursedTotal)}</strong></div>
     <div className="stat"><span>Recovery rate (target ≥75%)</span>
       <strong>{percent(overview.indicators.recoveryPercent)}</strong></div>
     <div className="stat"><span>PAR60 (limit ≤25%)</span><strong>{percent(overview.indicators.par60Percent)}</strong></div>
    </div>
    <div className="grid two">
     <section className="card stack"><h2>Portfolio accountability</h2>
      <div className="resource-facts">
       <div><span>Participating communities</span><strong>{overview.counts.communities}</strong></div>
       <div><span>Registered members</span><strong>{overview.counts.beneficiaries}</strong></div>
       <div><span>Outstanding principal</span><strong>{format(overview.indicators.amounts.outstandingTotal)}</strong></div>
       <div><span>Value to women-led enterprises</span><strong>{percent(overview.indicators.womenFundPercent)}</strong></div>
       <div><span>Due this month</span><strong>{format(overview.indicators.amounts.dueInPeriod)}</strong></div>
       <div><span>Recovered this month</span><strong>{format(overview.indicators.amounts.recoveredInPeriod)}</strong></div>
      </div>
     </section>
     <section className="card stack"><h2>Management attention</h2>
      <div className={overview.alerts.recoveryLow?"error":"notice"}>
       Recovery: {overview.indicators.recoveryPercent===null?
        "Not assessable without verified amounts due.":overview.alerts.recoveryLow?"Below the 75% standard.":"No underperformance alert."}</div>
      <div className={overview.alerts.par60High?"error":"notice"}>
       PAR60: {overview.indicators.par60Percent===null?"Not assessable without outstanding principal.":
        overview.alerts.par60High?"Above the 25% limit.":"Within the currently calculated limit."}</div>
      <p><strong>{overview.counts.pending_disbursements}</strong> disbursement records await independent verification.</p>
      <p><strong>{overview.counts.pending_repayments}</strong> repayment records await independent verification.</p>
      <p><strong>{overview.counts.assets_to_verify}</strong> financed assets await inspection.</p>
      <p><strong>{overview.counts.open_actions}</strong> corrective actions remain open.</p>
     </section>
    </div>
    <section className="card">
     <h3>About these numbers</h3>
     <p className="muted">{overview.limitations.join(" ")} The official signed report and reconciled statements remain the governing records.</p>
    </section>
   </>}
  </div>}
  {initialAccess&&tab==="registry"&&<div className="stack">
   {canRegistry&&<div className="grid two">
    <form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/registry",{
     action:"community",communityCode:record.communityCode,communityName:record.communityName,lgaCode:record.lgaCode
    });}}>
     <h3>Register a participating community</h3>
     <div className="field"><label>Community code</label><input required value={record.communityCode}
       onChange={e=>setRecord(x=>({...x,communityCode:e.target.value}))}/></div>
     <div className="field"><label>Community name</label><input required value={record.communityName}
       onChange={e=>setRecord(x=>({...x,communityName:e.target.value}))}/></div>
     <div className="field"><label>Local government</label><select required value={record.lgaCode}
       onChange={e=>setRecord(x=>({...x,lgaCode:e.target.value}))}>
       <option value="">Select approved LGA</option>{overview?.lgas.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}
      </select></div>
     <p className="muted">New communities remain drafts pending independent eligibility and bank-control review.</p>
     <button type="submit" className="btn primary" disabled={busy}>Save community draft</button>
    </form>
    <form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/registry",{
      action:"cig",communityId:record.communityId,cigCode:record.cigCode,
      cigName:record.cigName,enterpriseType:record.enterpriseType,
      womenLed:record.womenLed,savingsNgn:numeric(record.savingsNgn)
    });}}>
     <h3>Register a Community Interest Group</h3>
     <div className="field"><label>Registered community</label><select required value={record.communityId}
       onChange={e=>setRecord(x=>({...x,communityId:e.target.value}))}>
      <option value="">Select community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.community_name} · {c.lga_code}</option>)}
     </select></div>
     <div className="field"><label>CIG code</label><input required value={record.cigCode}
       onChange={e=>setRecord(x=>({...x,cigCode:e.target.value}))}/></div>
     <div className="field"><label>CIG name</label><input required value={record.cigName}
       onChange={e=>setRecord(x=>({...x,cigName:e.target.value}))}/></div>
     <div className="field"><label>Enterprise type</label><input required value={record.enterpriseType}
       onChange={e=>setRecord(x=>({...x,enterpriseType:e.target.value}))}/></div>
     <label><input type="checkbox" checked={record.womenLed}
       onChange={e=>setRecord(x=>({...x,womenLed:e.target.checked}))}/> Women-led / women-owned enterprise</label>
     <button type="submit" className="btn primary" disabled={busy}>Register group</button>
    </form>
   </div>}
   {canRegistry&&<form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/registry",{
    action:"member",cigId:record.cigId,memberReference:record.memberReference,
    sex:record.sex,participationVerified:false
   });}}>
    <h3>Add a CIG member reference</h3>
    <p className="muted">Store a group-assigned member reference, not an identity document or NIN. Each CIG must have exactly 15 independently verified members before qualification.</p>
    <div className="grid three">
     <div className="field"><label>CIG</label><select required value={record.cigId}
       onChange={e=>setRecord(x=>({...x,cigId:e.target.value}))}><option value="">Select CIG</option>
       {cigs.map(g=><option key={g.id} value={g.id}>{g.cig_name}</option>)}</select></div>
     <div className="field"><label>Member reference</label><input required value={record.memberReference}
       onChange={e=>setRecord(x=>({...x,memberReference:e.target.value}))}/></div>
     <div className="field"><label>Sex (for reporting)</label><select value={record.sex}
       onChange={e=>setRecord(x=>({...x,sex:e.target.value}))}>
       {["female","male","other","undisclosed"].map(v=><option key={v} value={v}>{v}</option>)}
      </select></div>
    </div>
    <button className="btn primary" type="submit" disabled={busy}>Add member record</button>
   </form>}
   {canRegistry&&<form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/registry",{
    action:"verify_community",...communityChecks
   });}}>
    <h3>Independent community and bank-control review</h3>
    <p className="muted">Enter the actual SPMU approval and T15 evidence references. A second authorized officer must verify a draft community.</p>
    <div className="grid three">
     <div className="field"><label>Draft community</label><select required value={communityChecks.communityId}
      onChange={e=>setCommunityChecks(x=>({...x,communityId:e.target.value}))}>
      <option value="">Select community</option>{communities.filter(c=>c.status==="draft").map(c=><option key={c.id} value={c.id}>{c.community_name}</option>)}
     </select></div>
     {([["approvalReference","SPMU approval memorandum"],["bankMandateRef","T15A bank mandate"],
       ["account1EvidenceRef","Account 1 evidence"],["account2EvidenceRef","Account 2 evidence"],
       ["spmuEndorsementRef","SPMU bank endorsement"]] as const).map(([key,label])=>
       <div className="field" key={key}><label>{label}</label><input required
        value={communityChecks[key]} onChange={e=>setCommunityChecks(x=>({...x,[key]:e.target.value}))}/></div>)}
    </div>
    <button className="btn primary" type="submit" disabled={busy}>Verify community eligibility evidence</button>
   </form>}
   <section className="card stack"><h3>Participating communities</h3>
    <div className="table-wrap"><table><thead><tr><th>Community</th><th>LGA</th><th>Status</th><th>Bank controls</th></tr></thead>
     <tbody>{communities.map(c=><tr key={c.id}>
      <td>{c.community_name} <small>({c.community_code})</small></td><td>{c.lga_code}</td><td>{c.status}</td>
      <td>{c.bank_controls_documented?"Documented":"Not yet verified"}</td>
     </tr>)}</tbody></table></div>
   </section>
   {canRegistry&&<section className="card stack">
    <h3>Independently verify member entries</h3>
    <div className="field"><label>Supporting verification reference</label><input
      value={memberVerificationRef} onChange={e=>setMemberVerificationRef(e.target.value)}
      placeholder="Approved member register and reviewer reference"/></div>
    <div className="table-wrap"><table><thead><tr><th>CIG</th><th>Member reference</th>
      <th>Sex</th><th>Review</th></tr></thead><tbody>
     {members.slice(0,100).map(m=><tr key={m.id}><td>{cigs.find(c=>c.id===m.cig_id)?.cig_name||"CIG"}</td>
      <td>{m.member_reference}</td><td>{m.sex}</td>
      <td>{m.participation_verified?"Verified":<button type="button" className="btn"
        disabled={busy||memberVerificationRef.trim().length<3} onClick={()=>
          void send("/api/crf/registry",{action:"verify_member",memberId:m.id,
            verificationRef:memberVerificationRef})}>Verify</button>}</td>
     </tr>)}</tbody></table></div>
   </section>}
   {canRegistry&&<form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/registry",{
      action:"qualify",cigId:record.cigId,qualificationRef:record.qualificationRef
    });}}>
    <h3>Qualify a CIG after independent review</h3>
    <p className="muted">The system checks exactly 15 members, a minimum of six women, and independent member verification. This action records qualification evidence, not financial approval.</p>
    <div className="grid two">
     <div className="field"><label>CIG</label><select required value={record.cigId}
      onChange={e=>setRecord(x=>({...x,cigId:e.target.value}))}>
      <option value="">Select group</option>{cigs.filter(c=>c.qualification!=="qualified").map(c=>
       <option key={c.id} value={c.id}>{c.cig_name} ({c.member_count}/15)</option>)}</select></div>
     <div className="field"><label>Qualification scoring/evidence reference</label><input required
      value={record.qualificationRef} onChange={e=>setRecord(x=>({...x,qualificationRef:e.target.value}))}/></div>
    </div>
    <button className="btn primary" type="submit" disabled={busy}>Record independent qualification</button>
   </form>}
   <section className="card stack"><h3>CIG eligibility register</h3>
    <div className="table-wrap"><table><thead><tr><th>Group</th><th>Community</th>
     <th>Members</th><th>Female</th><th>Verified members</th><th>Qualification</th></tr></thead>
     <tbody>{cigs.map(g=><tr key={g.id}><td>{g.cig_name}</td><td>{g.community_name}</td>
      <td>{g.member_count} / 15</td><td>{g.female_count} (min. 6)</td>
      <td>{g.verified_count}</td><td>{g.qualification}</td>
     </tr>)}</tbody></table></div>
    <p className="muted">Independent community and group approval requires documented controls and staff verification. Member entries remain unverified until the responsible officer reviews supporting records.</p>
   </section>
  </div>}
  {initialAccess&&tab==="finance"&&<div className="stack">
   {canFinance&&<form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/ledger",{
    action:"register_loan",cigId:loan.cigId,loanReference:loan.loanReference,cycle:numeric(loan.cycle),
    principalNgn:numeric(loan.principalNgn),approvedCeilingNgn:numeric(loan.approvedCeilingNgn),
    cbnRateReference:loan.cbnRateReference,tenorMonths:numeric(loan.tenorMonths),
    approvalMemoRef:loan.approvalMemoRef,approvalDate:loan.approvalDate,agreementRef:loan.agreementRef
   });}}>
    <h3>Record an externally approved CRF loan</h3>
    <p className="muted">This records a signed approval and loan agreement. It does not approve a new loan or instruct a bank to pay.</p>
    <div className="grid three">
     <div className="field"><label>Qualified CIG</label><select required value={loan.cigId}
      onChange={e=>setLoan(x=>({...x,cigId:e.target.value}))}><option value="">Choose CIG</option>
      {cigs.filter(c=>c.qualification==="qualified").map(c=><option key={c.id} value={c.id}>{c.cig_name}</option>)}</select></div>
     <div className="field"><label>Loan reference</label><input required value={loan.loanReference}
       onChange={e=>setLoan(x=>({...x,loanReference:e.target.value}))}/></div>
     <div className="field"><label>Cycle</label><input type="number" min={1} max={50} value={loan.cycle}
       onChange={e=>setLoan(x=>({...x,cycle:e.target.value}))}/></div>
     <div className="field"><label>Approved principal (₦)</label><input required type="number" min={1} step=".01" value={loan.principalNgn}
       onChange={e=>setLoan(x=>({...x,principalNgn:e.target.value}))}/></div>
     <div className="field"><label>Published CBN-linked ceiling (₦)</label><input required type="number" min={1} step=".01" value={loan.approvedCeilingNgn}
       onChange={e=>setLoan(x=>({...x,approvedCeilingNgn:e.target.value}))}/></div>
     <div className="field"><label>Tenor</label><select value={loan.tenorMonths}
       onChange={e=>setLoan(x=>({...x,tenorMonths:e.target.value}))}>
        {[3,6,12].map(v=><option key={v} value={v}>{v} months</option>)}
       </select></div>
     <div className="field"><label>CBN rate/ceiling circular reference</label><input required value={loan.cbnRateReference}
       onChange={e=>setLoan(x=>({...x,cbnRateReference:e.target.value}))}/></div>
     <div className="field"><label>SPMU approval memo</label><input required value={loan.approvalMemoRef}
       onChange={e=>setLoan(x=>({...x,approvalMemoRef:e.target.value}))}/></div>
     <div className="field"><label>Approval date</label><input required type="date" value={loan.approvalDate}
       onChange={e=>setLoan(x=>({...x,approvalDate:e.target.value}))}/></div>
     <div className="field"><label>Signed agreement reference</label><input required value={loan.agreementRef}
       onChange={e=>setLoan(x=>({...x,agreementRef:e.target.value}))}/></div>
    </div>
    <button className="btn primary" type="submit" disabled={busy}>Record signed loan file</button>
   </form>}
   <section className="card stack"><h3>Verified loan position</h3>
    <div className="table-wrap"><table><thead><tr><th>Loan</th><th>Group / LGA</th><th>Approved</th>
      <th>Verified disbursement</th><th>Principal recovered</th><th>Remaining principal</th></tr></thead>
     <tbody>{loans.map(l=><tr key={l.id}><td>{l.loan_reference}</td>
      <td>{l.cig_name} · {l.lga_code}</td><td>{format(l.principal_ngn)}</td>
      <td>{format(l.disbursed_ngn)}</td><td>{format(l.principal_repaid_ngn)}</td>
      <td>{format(Math.max(0,Number(l.disbursed_ngn)-Number(l.principal_repaid_ngn)))}</td>
     </tr>)}</tbody></table></div>
    <p className="muted">Recorded but unverified bank entries are excluded. Service charges, fees and principal are separately tracked in the private financial ledger.</p>
   </section>
   {canFinance&&<form className="card stack" onSubmit={e=>{e.preventDefault();void send("/api/crf/ledger",{
    action:"record_repayment",loanId:entry.loanId,paidAt:entry.paidAt,
    principalNgn:numeric(entry.principalNgn),serviceChargeNgn:numeric(entry.serviceChargeNgn),
    defaultFeeNgn:numeric(entry.defaultFeeNgn),bankReference:entry.bankReference,
    bankEvidenceRef:entry.bankEvidenceRef
   });}}>
    <h3>Record an Account 2 repayment for independent verification</h3>
    <div className="grid three">
     <div className="field"><label>Loan</label><select required value={entry.loanId}
      onChange={e=>setEntry(x=>({...x,loanId:e.target.value}))}><option value="">Select loan</option>
      {loans.map(l=><option key={l.id} value={l.id}>{l.loan_reference}</option>)}</select></div>
     <div className="field"><label>Bank transaction reference</label><input required value={entry.bankReference}
      onChange={e=>setEntry(x=>({...x,bankReference:e.target.value}))}/></div>
     <div className="field"><label>Account 2 bank evidence reference</label><input required value={entry.bankEvidenceRef}
      onChange={e=>setEntry(x=>({...x,bankEvidenceRef:e.target.value}))}/></div>
     <div className="field"><label>Principal (₦)</label><input required type="number" min={0} step=".01" value={entry.principalNgn}
      onChange={e=>setEntry(x=>({...x,principalNgn:e.target.value}))}/></div>
     <div className="field"><label>Service charge (₦)</label><input type="number" min={0} step=".01" value={entry.serviceChargeNgn}
      onChange={e=>setEntry(x=>({...x,serviceChargeNgn:e.target.value}))}/></div>
     <div className="field"><label>Default fee (₦)</label><input type="number" min={0} step=".01" value={entry.defaultFeeNgn}
      onChange={e=>setEntry(x=>({...x,defaultFeeNgn:e.target.value}))}/></div>
     <div className="field"><label>Payment date</label><input type="date" value={entry.paidAt}
      onChange={e=>setEntry(x=>({...x,paidAt:e.target.value}))}/></div>
    </div>
    <button type="submit" className="btn primary" disabled={busy}>Record pending repayment</button>
    <p className="muted">A different officer must independently verify the bank statement before this receipt affects recovery figures.</p>
   </form>}
   <CrfLedgerWorkflow loans={loans} roles={roles}/>
  </div>}
  {initialAccess&&tab==="field"&&<CrfFieldCenter cigs={cigs} communities={communities} roles={roles}/>}
  {admin&&tab==="access"&&<div className="card stack">
   <h2>Confidential CRF role assignments</h2>
   <p className="muted">Only grant duties to actual SPMU-authorized personnel. Existing CARE-Map staff access alone does not expose beneficiary and financial records.</p>
   <form className="grid three" onSubmit={e=>{e.preventDefault();void send("/api/crf/access",{
     action:"grant",userId:roleForm.userId,role:roleForm.role
   });}}>
    <div className="field"><label>Eligible staff account</label>
      <select required value={roleForm.userId} onChange={e=>setRoleForm(x=>({...x,userId:e.target.value}))}>
       <option value="">Choose staff</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
      </select></div>
    <div className="field"><label>CRF responsibility</label>
      <select value={roleForm.role} onChange={e=>setRoleForm(x=>({...x,role:e.target.value}))}>
       {roleOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></div>
    <div className="field"><label>Grant</label><button className="btn primary" type="submit" disabled={busy}>Grant CRF duty</button></div>
   </form>
   <div className="table-wrap"><table><thead><tr><th>Staff</th><th>CRF role</th><th>Action</th></tr></thead>
   <tbody>{assignments.map(a=><tr key={a.user_id+a.crf_role}><td>{a.name}</td>
     <td>{roleOptions.find(r=>r[0]===a.crf_role)?.[1]||a.crf_role}</td>
     <td><button className="btn" type="button" disabled={busy}
      onClick={()=>{if(confirm("Revoke this CRF duty?"))void send("/api/crf/access",{
        action:"revoke",userId:a.user_id,role:a.crf_role
      });}}>Revoke</button></td></tr>)}</tbody></table></div>
  </div>}
 </div>;
}
