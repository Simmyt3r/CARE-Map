import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {remoteSensingConfigured} from "@/lib/remote-sensing";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const result=await query(`
    SELECT m.id,m.name,m.source_analysis_id,m.reference_date,m.reference_mean_ndvi,m.reference_vegetation_ha,
      m.vegetation_threshold,m.observation_window_days,m.cadence_days,m.minimum_clear_fraction,m.alert_loss_pct,
      m.active,m.last_checked_at,m.last_success_at,m.next_due_at,m.created_at,
      round((ST_Area(m.aoi::geography)/10000.0)::numeric,2) aoi_area_ha,
      u.name created_by_name,
      COALESCE(a.open_alerts,0)::int open_alerts,
      o.observed_for last_observed_for,o.mean_ndvi last_mean_ndvi,o.clear_fraction last_clear_fraction,
      o.vegetation_ha last_vegetation_ha,o.change_ha last_change_ha,o.change_pct last_change_pct,
      o.severity last_severity,o.status last_observation_status,o.error_message last_error
    FROM vegetation_monitors m
    LEFT JOIN users u ON u.id=m.created_by
    LEFT JOIN LATERAL (
      SELECT count(*) open_alerts FROM vegetation_alerts va
      WHERE va.monitor_id=m.id AND va.acknowledged_at IS NULL
    ) a ON TRUE
    LEFT JOIN LATERAL (
      SELECT * FROM vegetation_monitor_observations vo
      WHERE vo.monitor_id=m.id ORDER BY vo.created_at DESC LIMIT 1
    ) o ON TRUE
    ORDER BY m.active DESC,m.next_due_at,m.name
  `);
  const analyses=await query(`
    SELECT id,name,comparison_date,comparison_mean_ndvi,comparison_vegetation_ha,
      vegetation_threshold,window_days,change_level
    FROM remote_sensing_analyses
    WHERE status='completed' AND comparison_vegetation_ha IS NOT NULL
    ORDER BY completed_at DESC LIMIT 200
  `);
  return NextResponse.json({data:result.rows,analyses:analyses.rows,configured:remoteSensingConfigured()});
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const body=await request.json().catch(()=>null) as {
    name?:string;sourceAnalysisId?:string;cadenceDays?:number;minimumClearFraction?:number;alertLossPct?:number
  }|null;
  if(!body?.name?.trim()||!body.sourceAnalysisId)return error("Monitor name and reference analysis are required.");

  const cadence=Math.min(90,Math.max(1,Number(body.cadenceDays||14)));
  const minimumClear=Number(body.minimumClearFraction??0.60);
  const alertLoss=Number(body.alertLossPct??10);
  if(!Number.isFinite(minimumClear)||minimumClear<0||minimumClear>1)return error("Minimum clear coverage must be between 0 and 1.");
  if(!Number.isFinite(alertLoss)||alertLoss<0.1||alertLoss>100)return error("Alert loss threshold must be between 0.1 and 100 percent.");

  const result=await query<{id:string}>(`
    INSERT INTO vegetation_monitors(
      name,source_analysis_id,aoi,reference_date,reference_mean_ndvi,reference_vegetation_ha,
      vegetation_threshold,observation_window_days,cadence_days,minimum_clear_fraction,
      alert_loss_pct,next_due_at,created_by
    )
    SELECT $1,r.id,r.aoi,r.comparison_date,r.comparison_mean_ndvi,r.comparison_vegetation_ha,
      r.vegetation_threshold,r.window_days,$3,$4,$5,now(),$6
    FROM remote_sensing_analyses r
    WHERE r.id=$2 AND r.status='completed' AND r.comparison_vegetation_ha IS NOT NULL
    RETURNING id
  `,[body.name.trim().slice(0,180),body.sourceAnalysisId,cadence,minimumClear,alertLoss,session.sub]);

  if(!result.rowCount)return error("Reference analysis must be a completed NDVI analysis with vegetation-area results.",400);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create','vegetation_monitor',$2,$3)",[
    session.sub,result.rows[0].id,JSON.stringify({sourceAnalysisId:body.sourceAnalysisId,cadence,minimumClear,alertLoss})
  ]);
  return NextResponse.json({data:{id:result.rows[0].id}},{status:201});
}
