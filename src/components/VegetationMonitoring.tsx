"use client";
import {useEffect,useState} from "react";
import VegetationMonitorDrawer from "@/components/VegetationMonitorDrawer";

export default function VegetationMonitoring(){
  const[monitors,setMonitors]=useState<any[]>([]);
  const[analyses,setAnalyses]=useState<any[]>([]);
  const[configured,setConfigured]=useState(false);
  const[selected,setSelected]=useState<any|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const[form,setForm]=useState({name:"",sourceAnalysisId:"",cadenceDays:"14",minimumClearFraction:"0.6",alertLossPct:"10"});

  async function load(){
    const r=await fetch("/api/remote-sensing/monitors");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Vegetation monitoring plans could not be loaded.");
    setMonitors(j.data||[]);setAnalyses(j.analyses||[]);setConfigured(Boolean(j.configured));
  }
  useEffect(()=>{void load();},[]);

  function selectAnalysis(id:string){
    const a=analyses.find(x=>x.id===id);
    setForm(x=>({...x,sourceAnalysisId:id,name:x.name||(a?String(a.name)+" monitoring":"")}));
  }

  async function create(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/monitors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      name:form.name,sourceAnalysisId:form.sourceAnalysisId,cadenceDays:Number(form.cadenceDays),
      minimumClearFraction:Number(form.minimumClearFraction),alertLossPct:Number(form.alertLossPct)
    })});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not create monitoring plan.");
    setForm({name:"",sourceAnalysisId:"",cadenceDays:"14",minimumClearFraction:"0.6",alertLossPct:"10"});
    setMessage("Vegetation monitoring plan created and queued for its first check.");await load();
  }

  const fmt=(v:any,n=1)=>v==null?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:n});

  return <div className="stack">
    {!configured&&<div className="notice"><strong>Monitoring plans can be prepared now.</strong> Automated satellite checks begin after Copernicus OAuth is configured.</div>}

    <section className="card stack">
      <div><h2>Create monitoring plan</h2><div className="muted">Use a completed NDVI comparison as the trusted reference state, then watch the same AOI for future vegetation loss.</div></div>
      <form className="stack" onSubmit={create}>
        <div className="grid two">
          <div className="field"><label>Reference NDVI analysis</label><select required value={form.sourceAnalysisId} onChange={e=>selectAnalysis(e.target.value)}><option value="">Choose completed analysis</option>{analyses.map(a=><option key={a.id} value={a.id}>{a.name} · {String(a.comparison_date).slice(0,10)} · {fmt(a.comparison_vegetation_ha)} ha vegetation</option>)}</select></div>
          <div className="field"><label>Monitoring plan name</label><input required value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Makurdi afforestation watch"/></div>
        </div>
        <div className="grid three">
          <div className="field"><label>Check cadence</label><select value={form.cadenceDays} onChange={e=>setForm(x=>({...x,cadenceDays:e.target.value}))}><option value="7">Every 7 days</option><option value="14">Every 14 days</option><option value="30">Every 30 days</option><option value="60">Every 60 days</option><option value="90">Every 90 days</option></select></div>
          <div className="field"><label>Minimum clear coverage</label><select value={form.minimumClearFraction} onChange={e=>setForm(x=>({...x,minimumClearFraction:e.target.value}))}><option value="0.4">40%</option><option value="0.5">50%</option><option value="0.6">60%</option><option value="0.7">70%</option><option value="0.8">80%</option></select></div>
          <div className="field"><label>Vegetation-loss alert</label><select value={form.alertLossPct} onChange={e=>setForm(x=>({...x,alertLossPct:e.target.value}))}><option value="5">5% loss</option><option value="10">10% loss</option><option value="15">15% loss</option><option value="20">20% loss</option><option value="25">25% loss</option><option value="30">30% loss</option></select></div>
        </div>
        <button className="btn primary" disabled={busy||!analyses.length}>{busy?"Creating…":"Create monitoring plan"}</button>
      </form>
      {!analyses.length&&<div className="notice">Complete at least one NDVI comparison in Remote Sensing before creating a monitor.</div>}
      {message&&<div className="notice">{message}</div>}
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Vegetation watchlist</h2><div className="muted">Scheduled checks compare fresh clear-pixel vegetation against each monitor&apos;s fixed reference state.</div></div><span className="badge">{monitors.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Monitor</th><th>Reference</th><th>Last observation</th><th>Latest change</th><th>Open alerts</th><th>Next check</th><th>Status</th><th></th></tr></thead>
        <tbody>{monitors.map(m=><tr key={m.id} className={Number(m.open_alerts)>0?"critical-row":""}>
          <td><strong>{m.name}</strong><div className="muted">Alert at ≥ {fmt(m.alert_loss_pct)}% loss</div></td>
          <td>{String(m.reference_date).slice(0,10)}<div className="muted">{fmt(m.reference_vegetation_ha)} ha</div></td>
          <td>{m.last_observed_for?String(m.last_observed_for).slice(0,10):"Never"}<div className="muted">{m.last_observation_status?.replaceAll("_"," ")||""}</div></td>
          <td className={Number(m.last_change_pct)<0?"overdue-text":""}>{m.last_change_pct==null?"—":fmt(m.last_change_pct)+"%"}{m.last_clear_fraction!=null?<div className="muted">{fmt(Number(m.last_clear_fraction)*100,0)}% clear</div>:null}</td>
          <td>{Number(m.open_alerts)>0?<span className="priority-badge priority-critical">{m.open_alerts}</span>:"0"}</td>
          <td>{new Date(m.next_due_at).toLocaleString()}</td>
          <td><span className={"priority-badge "+(m.active?"priority-low":"priority-medium")}>{m.active?"Active":"Paused"}</span></td>
          <td><button className="btn" onClick={()=>setSelected(m)}>Manage</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    {selected&&<VegetationMonitorDrawer monitor={selected} configured={configured} onClose={()=>setSelected(null)} onUpdated={load}/>}
  </div>;
}
