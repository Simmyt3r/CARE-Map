import type {QueryResultRow} from "pg";
import {query} from "@/lib/db";
import {changeLevel,fetchNdviStats,remoteSensingConfigured,searchSentinelScenes,type GeoPolygon} from "@/lib/remote-sensing";

export interface VegetationMonitorRow extends QueryResultRow{
  id:string;
  name:string;
  aoi_geometry:GeoPolygon;
  aoi_area_ha:number|string;
  reference_date:string;
  reference_mean_ndvi:number|string|null;
  reference_vegetation_ha:number|string;
  vegetation_threshold:number|string;
  observation_window_days:number;
  cadence_days:number;
  minimum_clear_fraction:number|string;
  alert_loss_pct:number|string;
  active:boolean;
  next_due_at:string;
}

function isoDate(date:Date){
  return date.toISOString().slice(0,10);
}

function windowStart(endDate:Date,days:number){
  const start=new Date(endDate);
  start.setUTCDate(start.getUTCDate()-days);
  return isoDate(start);
}

function alertSeverity(changePct:number){
  const level=changeLevel(changePct);
  return level==="low"?"medium":level;
}

export function shouldRaiseVegetationAlert(changePct:number|null,clearFraction:number|null,minimumClearFraction:number,alertLossPct:number){
  return changePct!=null&&clearFraction!=null&&clearFraction>=minimumClearFraction&&changePct<=-alertLossPct;
}

export async function runVegetationMonitor(monitorId:string,actorId:string|null=null,observedAt=new Date()){
  const result=await query<VegetationMonitorRow>(`
    SELECT m.*,ST_AsGeoJSON(m.aoi)::json aoi_geometry,
      ST_Area(m.aoi::geography)/10000.0 aoi_area_ha
    FROM vegetation_monitors m WHERE m.id=$1
  `,[monitorId]);
  const monitor=result.rows[0];
  if(!monitor)throw new Error("Vegetation monitor not found.");
  if(!remoteSensingConfigured())throw new Error("Copernicus Data Space OAuth is not configured.");

  const observedFor=isoDate(observedAt);
  const startDate=windowStart(observedAt,Number(monitor.observation_window_days));
  const referenceHa=Number(monitor.reference_vegetation_ha);
  const areaHa=Number(monitor.aoi_area_ha);
  const threshold=Number(monitor.vegetation_threshold);

  try{
    const [scenes,stats]=await Promise.all([
      searchSentinelScenes(monitor.aoi_geometry,startDate,Number(monitor.observation_window_days),70),
      fetchNdviStats(monitor.aoi_geometry,startDate,Number(monitor.observation_window_days),threshold,areaHa)
    ]);

    const clearFraction=stats.clearFraction;
    const minimumClear=Number(monitor.minimum_clear_fraction);
    const lowCoverage=clearFraction==null||clearFraction<minimumClear;
    const vegetationHa=stats.vegetationHa;
    const changeHa=vegetationHa==null?null:vegetationHa-referenceHa;
    const changePct=changeHa==null||referenceHa<=0?null:(changeHa/referenceHa)*100;
    const severity=changeLevel(changePct);
    const status=lowCoverage?"low_coverage":"completed";

    const observation=await query<{id:string}>(`
      INSERT INTO vegetation_monitor_observations(
        monitor_id,observed_for,scene,mean_ndvi,clear_fraction,vegetation_ha,
        change_ha,change_pct,severity,status,error_message,raw_stats
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11)
      ON CONFLICT(monitor_id,observed_for) DO UPDATE SET
        scene=EXCLUDED.scene,mean_ndvi=EXCLUDED.mean_ndvi,clear_fraction=EXCLUDED.clear_fraction,
        vegetation_ha=EXCLUDED.vegetation_ha,change_ha=EXCLUDED.change_ha,change_pct=EXCLUDED.change_pct,
        severity=EXCLUDED.severity,status=EXCLUDED.status,error_message=NULL,raw_stats=EXCLUDED.raw_stats,
        created_at=now()
      RETURNING id
    `,[
      monitor.id,observedFor,scenes[0]?JSON.stringify(scenes[0]):null,
      stats.meanNdvi,clearFraction,vegetationHa,changeHa,changePct,severity,status,JSON.stringify(stats.raw)
    ]);

    const nextDue=new Date(observedAt);
    nextDue.setUTCDate(nextDue.getUTCDate()+(lowCoverage?1:Number(monitor.cadence_days)));
    await query(`
      UPDATE vegetation_monitors SET
        last_checked_at=now(),
        last_success_at=CASE WHEN $2='completed' THEN now() ELSE last_success_at END,
        next_due_at=$3
      WHERE id=$1
    `,[monitor.id,status,nextDue.toISOString()]);

    let alertId:string|null=null;
    if(shouldRaiseVegetationAlert(changePct,clearFraction,minimumClear,Number(monitor.alert_loss_pct))){
      const severityForAlert=alertSeverity(changePct);
      const title=severityForAlert.charAt(0).toUpperCase()+severityForAlert.slice(1)+" vegetation loss: "+monitor.name;
      const message=
        "Sentinel-2 monitoring measured "+Math.abs(changePct).toFixed(1)+"% vegetation loss ("+
        Math.abs(changeHa||0).toFixed(1)+" ha) against the reference observation dated "+String(monitor.reference_date).slice(0,10)+".";
      const alert=await query<{id:string}>(`
        INSERT INTO vegetation_alerts(
          monitor_id,observation_id,severity,title,message,vegetation_change_ha,vegetation_change_pct
        ) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(observation_id) DO UPDATE SET
          severity=EXCLUDED.severity,title=EXCLUDED.title,message=EXCLUDED.message,
          vegetation_change_ha=EXCLUDED.vegetation_change_ha,
          vegetation_change_pct=EXCLUDED.vegetation_change_pct
        RETURNING id
      `,[monitor.id,observation.rows[0].id,severityForAlert,title,message,changeHa,changePct]);
      alertId=alert.rows[0].id;
    }else{
      await query("DELETE FROM vegetation_alerts WHERE observation_id=$1",[observation.rows[0].id]);
    }

    if(actorId){
      await query(
        "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'monitor_run','vegetation_monitor',$2,$3)",
        [actorId,monitor.id,JSON.stringify({observedFor,status,changePct,alertId})]
      );
    }

    return{
      monitorId:monitor.id,
      observationId:observation.rows[0].id,
      observedFor,
      status,
      scene:scenes[0]||null,
      stats,
      changeHa,
      changePct,
      severity,
      alertId
    };
  }catch(e){
    const message=e instanceof Error?e.message:"Vegetation monitoring failed.";
    await query(`
      INSERT INTO vegetation_monitor_observations(monitor_id,observed_for,severity,status,error_message)
      VALUES($1,$2,'low','failed',$3)
      ON CONFLICT(monitor_id,observed_for) DO UPDATE SET
        severity='low',status='failed',error_message=EXCLUDED.error_message,created_at=now()
    `,[monitor.id,observedFor,message.slice(0,2000)]);
    const retry=new Date(observedAt);retry.setUTCDate(retry.getUTCDate()+1);
    await query("UPDATE vegetation_monitors SET last_checked_at=now(),next_due_at=$2 WHERE id=$1",[monitor.id,retry.toISOString()]);
    throw e;
  }
}

export function monitorDue(now:Date,nextDue:string){
  return new Date(nextDue).getTime()<=now.getTime();
}
