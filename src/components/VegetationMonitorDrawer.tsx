"use client";
import {useEffect,useState} from "react";

export default function VegetationMonitorDrawer({monitor,configured,onClose,onUpdated}:{monitor:any;configured:boolean;onClose:()=>void;onUpdated:()=>void}){
  const[observations,setObservations]=useState<any[]>([]);
  const[form,setForm]=useState({
    active:Boolean(monitor.active),
    cadenceDays:String(monitor.cadence_days||14),
    minimumClearFraction:String(monitor.minimum_clear_fraction??0.6),
    alertLossPct:String(monitor.alert_loss_pct||10)
  });
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/api/remote-sensing/monitors/"+monitor.id+"/observations");
    const j=await r.json().catch(()=>({}));
    if(r.ok)setObservations(j.data||[]);
  }
  useEffect(()=>{void load();},[monitor.id]);

  async function save(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/monitors/"+monitor.id,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        active:form.active,
        cadenceDays:Number(form.cadenceDays),
        minimumClearFraction:Number(form.minimumClearFraction),
        alertLossPct:Number(form.alertLossPct)
      })
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Monitor update failed.");
    setMessage("Monitoring plan updated.");onUpdated();
  }

  async function runNow(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/remote-sensing/monitors/"+monitor.id+"/run",{method:"POST"});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Monitoring run failed.");
    setMessage(j.data.alertId?"Monitoring complete. A vegetation alert was raised.":"Monitoring complete. No vegetation-loss alert was raised.");
    await load();onUpdated();
  }

  async function acknowledge(id:string){
    const r=await fetch("/api/remote-sensing/alerts/"+id+"/acknowledge",{method:"POST"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Alert acknowledgement failed.");
    setMessage("Vegetation alert acknowledged.");await load();onUpdated();
  }

  const fmt=(v:any,n=1)=>v==null?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:n});

  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
    <aside className="resource-drawer remote-drawer">
      <div className="section-head">
        <div><h2>{monitor.name}</h2><div className="muted">Automated Sentinel-2 vegetation monitoring</div></div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      <div className="stack">
        <section className="drawer-section stack">
          <h3>Reference state</h3>
          <div className="resource-facts">
            <div><span>Reference date</span><strong>{String(monitor.reference_date).slice(0,10)}</strong></div>
            <div><span>Reference vegetation</span><strong>{fmt(monitor.reference_vegetation_ha)} ha</strong></div>
            <div><span>Reference mean NDVI</span><strong>{fmt(monitor.reference_mean_ndvi,3)}</strong></div>
            <div><span>AOI area</span><strong>{fmt(monitor.aoi_area_ha)} ha</strong></div>
          </div>
        </section>

        <section className="drawer-section stack">
          <h3>Monitoring policy</h3>
          <label className="check-field"><input type="checkbox" checked={form.active} onChange={e=>setForm(x=>({...x,active:e.target.checked}))}/> Monitoring active</label>
          <div className="grid three">
            <div className="field"><label>Cadence</label><select value={form.cadenceDays} onChange={e=>setForm(x=>({...x,cadenceDays:e.target.value}))}><option value="7">Every 7 days</option><option value="14">Every 14 days</option><option value="30">Every 30 days</option><option value="60">Every 60 days</option><option value="90">Every 90 days</option></select></div>
            <div className="field"><label>Minimum clear coverage</label><select value={form.minimumClearFraction} onChange={e=>setForm(x=>({...x,minimumClearFraction:e.target.value}))}><option value="0.4">40%</option><option value="0.5">50%</option><option value="0.6">60%</option><option value="0.7">70%</option><option value="0.8">80%</option></select></div>
            <div className="field"><label>Alert when vegetation loss reaches</label><select value={form.alertLossPct} onChange={e=>setForm(x=>({...x,alertLossPct:e.target.value}))}><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option></select></div>
          </div>
          <div className="actions"><button className="btn primary" disabled={busy} onClick={save}>Save policy</button><button className="btn" disabled={busy||!configured} onClick={runNow}>Check now</button></div>
          {!configured&&<div className="notice">Manual and scheduled checks activate after Copernicus OAuth is configured.</div>}
        </section>

        <section className="drawer-section stack">
          <div className="section-head"><div><h3>Observation history</h3><div className="muted">Cloud-poor observations are retained but never treated as vegetation-loss evidence.</div></div><span className="badge">{observations.length}</span></div>
          <div className="monitor-history">
            {observations.map(o=><div className="monitor-observation" key={o.id}>
              <div className="section-head">
                <div><strong>{String(o.observed_for).slice(0,10)}</strong><small>{o.scene?.id||"No catalog scene metadata"}</small></div>
                <span className={"priority-badge priority-"+(o.status==="failed"?"critical":o.status==="low_coverage"?"medium":o.severity)}>{o.status.replaceAll("_"," ")}</span>
              </div>
              <div className="monitor-metrics"><span>NDVI <b>{fmt(o.mean_ndvi,3)}</b></span><span>Clear <b>{o.clear_fraction==null?"—":fmt(Number(o.clear_fraction)*100,0)+"%"}</b></span><span>Vegetation <b>{fmt(o.vegetation_ha)} ha</b></span><span>Change <b className={Number(o.change_pct)<0?"overdue-text":""}>{o.change_pct==null?"—":fmt(o.change_pct)+"%"}</b></span></div>
              {o.error_message&&<div className="error">{o.error_message}</div>}
              {o.alert_id&&<div className="vegetation-alert-inline"><div><strong>{o.alert_title}</strong><p>{o.alert_message}</p></div>{o.acknowledged_at?<span className="badge">Acknowledged</span>:<button className="btn" disabled={busy} onClick={()=>acknowledge(o.alert_id)}>Acknowledge</button>}</div>}
            </div>)}
            {!observations.length&&<div className="muted">No satellite observations have been run for this monitor yet.</div>}
          </div>
        </section>

        {message&&<div className={message.includes("failed")?"error":"notice"}>{message}</div>}
      </div>
    </aside>
  </div>;
}
