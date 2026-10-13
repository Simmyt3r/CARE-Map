"use client";
import {useCallback,useEffect,useState} from "react";
import {useFieldGps} from "@/lib/field-gps";

type Project={
  id:string;project_code:string;project_name:string;project_type:string;
  community_name:string;lga_code:string;latitude:number;longitude:number;
  contact_name:string;contact_phone:string;contact_role:string|null;location_review:string;
  gps_accuracy_m:number|null;project_status:string;capture_source:string;captured_at:string|null
};
type Score={
  id:string;intervention_id:string;project_name:string;community_name:string;
  assessed_on:string;evaluator_name:string;evidence_notes:string;verification_status:string;
  maintenance_score:number;function_score:number;cleanliness_score:number;participation_score:number;
  evidence_photo_url:string|null
};
type Leader={
  id:string;project_name:string;community_name:string;project_type:string;score:number|null;
  reviews:number;eligible:boolean;eligible_peers:number;competition_rank:number|null;location_review:string
};
type Visit={id:string;project_name:string;community_name:string;visit_date:string;visit_type:string;guidance:string;next_visit_due:string|null};
type Data={projects:Project[];assessments:Score[];leaderboard:Leader[];visits:Visit[];rewards:any[]};
type Lga={code:string;name:string};
const typeChoices=[["borehole","Borehole"],["afforestation","Afforestation"],["erosion_control","Erosion control"],
  ["watershed_restoration","Watershed restoration"],["livelihood","Livelihood"],["other","Other"]] as const;
const today=new Date().toISOString().slice(0,10);
const ninetyDaysAgo=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
const newProject={
  projectCode:"",projectName:"",projectType:"borehole",communityName:"",lgaCode:"",
  latitude:"",longitude:"",gpsAccuracy:"",captureSource:"manual",capturedAt:"",
  contactName:"",contactPhone:"",contactRole:"",contactConsent:false,
  projectStatus:"active",description:""
};
const scoreNames=[["maintenance","Maintenance routine"],["function","Project functionality"],
  ["cleanliness","Site condition / cleanliness"],["participation","Community participation"]] as const;

export default function ExtensionCenter({admin}:{admin:boolean}){
  const[data,setData]=useState<Data>({projects:[],assessments:[],leaderboard:[],visits:[],rewards:[]});
  const[lgas,setLgas]=useState<Lga[]>([]);
  const[tab,setTab]=useState<"projects"|"visits"|"competition">("projects");
  const[form,setForm]=useState({...newProject});
  const gps=useFieldGps(fix=>setForm(x=>({
    ...x,latitude:fix.latitude.toFixed(7),longitude:fix.longitude.toFixed(7),
    gpsAccuracy:fix.accuracyMeters.toFixed(1),capturedAt:fix.capturedAt,
    captureSource:"device_gps"
  })),setMessage);
  function manualCoordinate(key:"latitude"|"longitude",value:string){
    gps.cancel();
    setForm(x=>({...x,[key]:value,gpsAccuracy:"",capturedAt:"",captureSource:"manual"}));
  }
  const[busy,setBusy]=useState(false);
  const[loading,setLoading]=useState(false);
  const[projectSearch,setProjectSearch]=useState("");
  const[projectTypeFilter,setProjectTypeFilter]=useState("all");
  const[message,setMessage]=useState("");
  const[visit,setVisit]=useState({interventionId:"",visitDate:today,visitType:"training",
    guidance:"",outcome:"",nextVisitDue:""});
  const[assessment,setAssessment]=useState({interventionId:"",assessedOn:today,
    maintenance:3,function:3,cleanliness:3,participation:3,evidenceNotes:""});
  const[reviewNotes,setReviewNotes]=useState("");
  const[reward,setReward]=useState({interventionId:"",periodStart:ninetyDaysAgo,periodEnd:today,
    decision:"recommended",justification:""});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [a,b]=await Promise.all([
        fetch("/api/extension",{cache:"no-store"}),
        fetch("/api/lgas",{cache:"no-store"})
      ]);
      const aj=await a.json().catch(()=>({})),bj=await b.json().catch(()=>({}));
      if(a.ok)setData({projects:aj.projects||[],assessments:aj.assessments||[],
        leaderboard:aj.leaderboard||[],visits:aj.visits||[],rewards:aj.rewards||[]});
      else setMessage(aj.error?.message||"Extension data is unavailable. Confirm database migrations 016 and 017.");
      if(b.ok)setLgas(bj.data||[]);
    }catch{
      setMessage("Could not connect to the extension service. Check the network and retry.");
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function save(payload:Record<string,unknown>){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/extension",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
      });
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(json.error?.message||"Request failed.");
      setMessage(json.message||"Saved.");
      await load();
      return true;
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");return false;}
    finally{setBusy(false);}
  }
  async function uploadAssessmentPhoto(assessmentId:string,file:File){
    setBusy(true);setMessage("Uploading field evidence…");
    try{
      const formData=new FormData();
      formData.set("file",file);
      const response=await fetch("/api/extension/assessments/"+assessmentId+"/photo",{
        method:"POST",body:formData
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error?.message||"Evidence upload failed.");
      setMessage("Photo evidence uploaded. An independent administrator may verify the assessment.");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Evidence upload failed.");}
    finally{setBusy(false);}
  }

  async function submitProject(e:React.FormEvent){
    e.preventDefault();
    gps.cancel();
    const lat=Number(form.latitude),lng=Number(form.longitude);
    if(!form.latitude.trim()||!form.longitude.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)){
      setMessage("Enter valid latitude and longitude.");return;
    }
    const success=await save({
      action:"create_project",...form,latitude:lat,longitude:lng,
      gpsAccuracy:form.gpsAccuracy?Number(form.gpsAccuracy):null,
      capturedAt:form.capturedAt||null
    });
    if(success){setForm({...newProject,lgaCode:form.lgaCode});}
  }
  const eligible=data.leaderboard.filter(x=>x.eligible&&Number(x.eligible_peers)>=2);
  const visibleProjects=data.projects.filter(p=>{
    const search=projectSearch.trim().toLowerCase();
    return (projectTypeFilter==="all"||p.project_type===projectTypeFilter)&&
      (!search||[p.project_name,p.project_code,p.community_name,p.lga_code]
        .some(value=>String(value).toLowerCase().includes(search)));
  });
  return <div className="stack">
    <section className="card stack">
      <div className="section-head">
        <div><h2>Community extension & stewardship</h2>
          <p className="muted">Manage interventions, protect local contact details, document guidance and evaluate care for comparable projects.</p></div>
        <button className="btn" disabled={loading} onClick={()=>void load()}>{loading?"Refreshing…":"Refresh"}</button>
      </div>
      <div className="stats">
        <div className="stat"><strong>{data.projects.length}</strong><span>Interventions</span></div>
        <div className="stat"><strong>{data.projects.filter(p=>p.location_review==="verified").length}</strong><span>GPS verified</span></div>
        <div className="stat"><strong>{data.visits.length}</strong><span>Recent extension visits</span></div>
        <div className="stat"><strong>{eligible.length}</strong><span>Competition eligible</span></div>
      </div>
      <div className="staff-tabs" aria-label="Extension workflow">
        <button className="btn" aria-pressed={tab==="projects"} type="button" onClick={()=>setTab("projects")}>Projects & contacts</button>
        <button className="btn" aria-pressed={tab==="visits"} type="button" onClick={()=>setTab("visits")}>Extension visits</button>
        <button className="btn" aria-pressed={tab==="competition"} type="button" onClick={()=>setTab("competition")}>Community competition</button>
      </div>
      {admin&&<div className="notice"><strong>First-time rollout:</strong> Apply pending migrations 016 and 017 before creating projects. Your existing admin session is sufficient; no additional credentials are required.
        <div className="actions"><a className="btn" href="/staff/admin/migrations">Open Admin Migrations</a></div>
      </div>}
      {loading&&<div role="status" className="notice">Loading extension records…</div>}
      {message&&<div role="status" className={/failed|could not|invalid|error/i.test(message)?"error":"notice"}>{message}</div>}
    </section>

    {tab==="projects"&&<>
      <form className="card stack" onSubmit={submitProject}>
        <h2>Register ACReSAL intervention</h2>
        <p className="muted">Every intervention needs a community focal person who agrees to be contacted. Their telephone number stays in staff-only records.</p>
        <div className="extension-form-divider"><span>01</span><div><strong>Intervention details</strong><small>Identify the project and community.</small></div></div>
        <div className="grid two">
          <div className="field"><label>Project code</label><input required value={form.projectCode} onChange={e=>setForm(x=>({...x,projectCode:e.target.value}))} placeholder="BEN-MAK-001"/></div>
          <div className="field"><label>Project name</label><input required value={form.projectName} onChange={e=>setForm(x=>({...x,projectName:e.target.value}))}/></div>
          <div className="field"><label>Project type</label><select value={form.projectType} onChange={e=>setForm(x=>({...x,projectType:e.target.value}))}>{typeChoices.map(([code,name])=><option value={code} key={code}>{name}</option>)}</select></div>
          <div className="field"><label>Community name</label><input required value={form.communityName} onChange={e=>setForm(x=>({...x,communityName:e.target.value}))}/></div>
          <div className="field"><label>Benue LGA</label><select required value={form.lgaCode} onChange={e=>setForm(x=>({...x,lgaCode:e.target.value}))}><option value="">Choose LGA</option>{lgas.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></div>
          <div className="field"><label>Project status</label><select value={form.projectStatus} onChange={e=>setForm(x=>({...x,projectStatus:e.target.value}))}>{["planned","active","completed","needs_maintenance","closed"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></div>
          <div className="extension-form-divider"><span>02</span><div><strong>Project coordinates</strong><small>Device GPS is preferred; all locations require review.</small></div></div>
          <div className="field"><label>Latitude</label><input required inputMode="decimal" value={form.latitude} onChange={e=>manualCoordinate("latitude",e.target.value)}/></div>
          <div className="field"><label>Longitude</label><input required inputMode="decimal" value={form.longitude} onChange={e=>manualCoordinate("longitude",e.target.value)}/></div>
        </div>
        <div className="actions"><button type="button" className="btn" disabled={gps.capturing||busy} onClick={gps.capture}>{gps.capturing?"Refining GPS…":"Capture device GPS"}</button>
          {gps.capturing&&<button type="button" className="btn" onClick={()=>{gps.cancel();setMessage("GPS acquisition cancelled.");}}>Cancel</button>}
          <span className="muted">{form.gpsAccuracy?"Reported ±"+form.gpsAccuracy+" m · ":""}{form.captureSource.replaceAll("_"," ")}</span>
        </div>
        <div className="extension-form-divider"><span>03</span><div><strong>Community focal person</strong><small>Contact details are available to staff only.</small></div></div>
        <p className="muted">GPS continuously refines for up to 30 seconds. Target accuracy ≤30 m. Keep the device stationary and review the project marker. Manual edits clear device-GPS provenance.</p>
        {form.captureSource==="device_gps"&&Number(form.gpsAccuracy)>30&&<div className="notice" role="status">GPS is low-confidence (±{form.gpsAccuracy} m). Recapture before requesting verification.</div>}
        <div className="grid two">
          <div className="field"><label>Community contact name</label><input required value={form.contactName} onChange={e=>setForm(x=>({...x,contactName:e.target.value}))}/></div>
          <div className="field"><label>Community contact phone</label><input required type="tel" value={form.contactPhone} onChange={e=>setForm(x=>({...x,contactPhone:e.target.value}))}/></div>
          <div className="field"><label>Contact role</label><input value={form.contactRole} onChange={e=>setForm(x=>({...x,contactRole:e.target.value}))} placeholder="Community maintenance committee representative"/></div>
          <div className="field"><label>Description / intervention scope</label><input value={form.description} onChange={e=>setForm(x=>({...x,description:e.target.value}))}/></div>
        </div>
        <label className="check-field">
          <input type="checkbox" required checked={form.contactConsent} onChange={e=>setForm(x=>({...x,contactConsent:e.target.checked}))}/>
          Contact has agreed to receive CARE-Map project coordination communications.
        </label>
        <button className="btn primary" disabled={busy||gps.capturing||!form.contactConsent}>Save intervention & contact</button>
      </form>
      <section className="card stack">
        <div className="section-head"><div><h2>Registered interventions</h2>
          <p className="muted" style={{margin:"4px 0 0"}}>{visibleProjects.length} of {data.projects.length} projects shown</p></div></div>
        <div className="grid two">
          <div className="field"><label htmlFor="extension-project-search">Search community, code, project or LGA</label>
            <input id="extension-project-search" type="search" placeholder="Find an intervention…" value={projectSearch}
              onChange={e=>setProjectSearch(e.target.value)}/>
          </div>
          <div className="field"><label htmlFor="extension-type-filter">Project type</label>
            <select id="extension-type-filter" value={projectTypeFilter} onChange={e=>setProjectTypeFilter(e.target.value)}>
              <option value="all">All project types</option>
              {typeChoices.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        {!visibleProjects.length&&<div className="empty-state">
          <strong>{data.projects.length?"No matching interventions":"No interventions recorded"}</strong>
          <p>{data.projects.length?"Try another search or project type.":"Register the first project and consenting community contact above."}</p>
        </div>}
        {!!visibleProjects.length&&<div className="table-wrap"><table>
          <thead><tr><th>Project</th><th>Community / LGA</th><th>Focal contact (staff only)</th><th>Location</th><th>Review</th></tr></thead>
          <tbody>{visibleProjects.map(p=><tr key={p.id}>
            <td><strong>{p.project_name}</strong><small>{p.project_code} · {p.project_type.replaceAll("_"," ")}</small></td>
            <td>{p.community_name}<small>{p.lga_code}</small></td>
            <td>{p.contact_name}<small>{p.contact_phone} · {p.contact_role||"Contact"}</small></td>
            <td>{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}<small>{p.gps_accuracy_m!=null?"±"+p.gps_accuracy_m+" m · ":""}{p.capture_source}</small></td>
            <td><span className="badge">{p.location_review}</span>
              {admin&&p.location_review==="pending"&&<div className="actions">
                <button className="btn" disabled={busy} onClick={()=>void save({action:"review_location",interventionId:p.id,
                  decision:"verified",notes:"Reviewed reported GPS accuracy, capture source and approved LGA boundary."})}>Verify location</button>
                <button className="btn" disabled={busy} onClick={()=>void save({action:"review_location",interventionId:p.id,
                  decision:"rejected",notes:"Location requires new field capture or clarification."})}>Reject</button>
              </div>}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>}

    {tab==="visits"&&<>
      <form className="card stack" onSubmit={async e=>{e.preventDefault();if(await save({action:"visit",...visit,nextVisitDue:visit.nextVisitDue||null})){setVisit(x=>({...x,guidance:"",outcome:""}));}}}>
        <h2>Record extension officer visit</h2>
        <div className="grid two">
          <div className="field"><label>Intervention / community</label><select required value={visit.interventionId} onChange={e=>setVisit(x=>({...x,interventionId:e.target.value}))}><option value="">Choose project</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.community_name} · {p.project_name}</option>)}</select></div>
          <div className="field"><label>Visit date</label><input type="date" required value={visit.visitDate} onChange={e=>setVisit(x=>({...x,visitDate:e.target.value}))}/></div>
          <div className="field"><label>Visit activity</label><select value={visit.visitType} onChange={e=>setVisit(x=>({...x,visitType:e.target.value}))}>{["training","maintenance_support","inspection","community_meeting","follow_up"].map(t=><option value={t} key={t}>{t.replaceAll("_"," ")}</option>)}</select></div>
          <div className="field"><label>Next follow-up</label><input type="date" value={visit.nextVisitDue} onChange={e=>setVisit(x=>({...x,nextVisitDue:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Guidance delivered / activity performed</label><textarea required value={visit.guidance} onChange={e=>setVisit(x=>({...x,guidance:e.target.value}))}/></div>
        <div className="field"><label>Observations / community response</label><textarea value={visit.outcome} onChange={e=>setVisit(x=>({...x,outcome:e.target.value}))}/></div>
        <button className="btn primary" disabled={busy}>Save extension visit</button>
      </form>
      <section className="card stack"><h2>Recent extension visits</h2>
        {!data.visits.length&&<div className="empty-state"><strong>No extension visits recorded</strong><p>Start by recording a field visit above.</p></div>}
        {!!data.visits.length&&<div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Project</th><th>Activity</th><th>Guidance</th><th>Follow-up</th></tr></thead>
        <tbody>{data.visits.map(v=><tr key={v.id}><td>{String(v.visit_date).slice(0,10)}</td><td>{v.community_name} · {v.project_name}</td><td>{v.visit_type.replaceAll("_"," ")}</td><td>{v.guidance}</td><td>{v.next_visit_due?String(v.next_visit_due).slice(0,10):"None"}</td></tr>)}</tbody>
      </table></div>}</section>
    </>}

    {tab==="competition"&&<>
      <section className="card stack">
        <h2>Community stewardship competition</h2>
        <p className="muted">Compare communities only within the same project type over the latest 90 days. Maintenance (35%), functionality (30%), site care (15%) and participation (20%) contribute to each 100-point score. At least two independently verified, photo-backed assessments on dates at least 14 days apart, a verified location and two eligible competing projects are required.</p>
        <div className="notice">A high score is not an entitlement to another project. The program team must review equity, technical feasibility, funding and approvals before allocating any reward.</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Project type</th><th>Community / project</th><th>Score</th><th>Verified reviews</th><th>Rank</th><th>Eligibility</th></tr></thead>
          <tbody>{data.leaderboard.map(row=><tr key={row.id}>
            <td>{row.project_type.replaceAll("_"," ")}</td><td><strong>{row.community_name}</strong><small>{row.project_name}</small></td>
            <td>{row.score==null?"—":row.score+"/100"}</td><td>{row.reviews}</td>
            <td>{row.eligible&&Number(row.eligible_peers)>=2?row.competition_rank:"—"}</td>
            <td>{row.eligible&&Number(row.eligible_peers)>=2?"Eligible":"Awaiting evidence / peers"}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <form className="card stack" onSubmit={async e=>{e.preventDefault();if(await save({action:"assess",...assessment}))setAssessment(x=>({...x,evidenceNotes:""}));}}>
        <h2>Submit field maintenance assessment</h2>
        <div className="grid two">
          <div className="field"><label>Project</label><select required value={assessment.interventionId} onChange={e=>setAssessment(x=>({...x,interventionId:e.target.value}))}><option value="">Choose project</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.community_name} · {p.project_name}</option>)}</select></div>
          <div className="field"><label>Date assessed</label><input required type="date" value={assessment.assessedOn} onChange={e=>setAssessment(x=>({...x,assessedOn:e.target.value}))}/></div>
        </div>
        <div className="grid two">{scoreNames.map(([key,label])=><div className="field" key={key}>
          <label>{label} (0 to 5)</label><select value={assessment[key]} onChange={e=>setAssessment(x=>({...x,[key]:Number(e.target.value)}))}>{[0,1,2,3,4,5].map(n=><option value={n} key={n}>{n}</option>)}</select>
        </div>)}</div>
        <div className="field"><label>Evidence and observations (required)</label><textarea required minLength={20} value={assessment.evidenceNotes} onChange={e=>setAssessment(x=>({...x,evidenceNotes:e.target.value}))} placeholder="Observed condition, records checked, inspection method, photographs in project evidence repository…"/></div>
        <button disabled={busy} className="btn primary">Submit for independent verification</button>
      </form>

      <section className="card stack">
        <h2>Assessment review queue</h2>
        <div className="notice">Each assessment requires a non-sensitive field evidence photo in Cloudinary plus a separate administrator review before its score can count. Do not include faces, private contacts or other personal identifiers.</div>
        {admin&&<div className="field"><label>Administrator review notes</label><input value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} placeholder="Reason for acceptance or rejection (10+ characters)"/></div>}
        <div className="table-wrap"><table>
          <thead><tr><th>Community</th><th>Assessment</th><th>Evaluator</th><th>Evidence</th><th>State / review</th></tr></thead>
          <tbody>{data.assessments.map(a=><tr key={a.id}>
            <td>{a.community_name}<small>{a.project_name}</small></td>
            <td>{String(a.assessed_on).slice(0,10)}<small>{[a.maintenance_score,a.function_score,a.cleanliness_score,a.participation_score].join(" / ")}</small></td>
            <td>{a.evaluator_name}</td><td>{a.evidence_notes}
              <div className="stack">
                {a.evidence_photo_url?<a href={a.evidence_photo_url} target="_blank" rel="noreferrer">View field photo evidence</a>:
                  a.verification_status==="pending"?<label className="btn">Attach field photo
                    <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy}
                      onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAssessmentPhoto(a.id,file);e.currentTarget.value="";}}/>
                  </label>:<small>No photo attached</small>}
              </div>
            </td><td>{a.verification_status}
              {admin&&a.verification_status==="pending"&&<div className="actions">
                <button className="btn" disabled={busy||reviewNotes.trim().length<10} onClick={()=>void save({action:"review_assessment",assessmentId:a.id,decision:"verified",reviewerNotes:reviewNotes})}>Verify</button>
                <button className="btn" disabled={busy||reviewNotes.trim().length<10} onClick={()=>void save({action:"review_assessment",assessmentId:a.id,decision:"rejected",reviewerNotes:reviewNotes})}>Reject</button>
              </div>}</td>
          </tr>)}</tbody></table></div>
      </section>
      {admin&&<form className="card stack" onSubmit={e=>{e.preventDefault();void save({action:"reward_decision",...reward});}}>
        <h2>Administrator reward recommendation / decision</h2>
        <p className="muted">Only top-ranked eligible communities in a sufficiently populated same-type comparison can be recommended or approved. Check that disadvantaged communities are not excluded simply because they have fewer resources. An approval records the decision; it does not create or fund another project.</p>
        <div className="grid two">
          <div className="field"><label>Eligible project</label><select required value={reward.interventionId} onChange={e=>setReward(x=>({...x,interventionId:e.target.value}))}><option value="">Choose project</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.community_name} · {p.project_name} ({p.score})</option>)}</select></div>
          <div className="field"><label>Decision</label><select value={reward.decision} onChange={e=>setReward(x=>({...x,decision:e.target.value}))}><option value="recommended">Recommend for consideration</option><option value="approved">Approved by authorized program manager</option><option value="declined">Declined</option></select></div>
          <div className="field"><label>Assessment period starts</label><input type="date" required value={reward.periodStart} onChange={e=>setReward(x=>({...x,periodStart:e.target.value}))}/></div>
          <div className="field"><label>Assessment period ends</label><input type="date" required value={reward.periodEnd} onChange={e=>setReward(x=>({...x,periodEnd:e.target.value}))}/></div>
        </div>
        <div className="field"><label>Justification and eligibility / funding review</label><textarea minLength={20} required value={reward.justification} onChange={e=>setReward(x=>({...x,justification:e.target.value}))}/></div>
        <button className="btn primary" disabled={busy}>Save decision</button>
        {data.rewards.length>0&&<div className="table-wrap"><table><thead><tr><th>Community</th><th>Decision</th><th>Period</th></tr></thead><tbody>{data.rewards.map(x=><tr key={x.id}><td>{x.community_name} · {x.project_name}</td><td>{x.decision}</td><td>{String(x.period_start).slice(0,10)} to {String(x.period_end).slice(0,10)}</td></tr>)}</tbody></table></div>}
      </form>}
    </>}
  </div>;
}
