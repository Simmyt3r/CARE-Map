import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {comparisonWindowError} from "@/lib/sentinel-date-quality";
import {
  assessNdviQuality,changeLevel,fetchNdviStats,NoSentinelObservationError,remoteSensingConfigured,searchSentinelScenes,
  type RemoteSensingRow
} from "@/lib/remote-sensing";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function POST(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;

  const current=await query<RemoteSensingRow>(`
    SELECT r.*,ST_AsGeoJSON(r.aoi)::json aoi_geometry,ST_Area(r.aoi::geography)/10000.0 aoi_area_ha
    FROM remote_sensing_analyses r WHERE r.id=$1
  `,[id]);
  const row=current.rows[0];
  if(!row)return error("Analysis not found",404);

  const windowIssue=comparisonWindowError(row.baseline_date,row.comparison_date,Number(row.window_days));
  if(windowIssue){
    await query("UPDATE remote_sensing_analyses SET status='needs_review',quality_notes=$1,error_message=NULL,publish_to_map=FALSE WHERE id=$2",
      [windowIssue,id]);
    return error(windowIssue+" Create a new analysis with completed dates; the original AOI remains saved.",409,"INVALID_OBSERVATION_WINDOW");
  }

  if(!remoteSensingConfigured()){
    await query("UPDATE remote_sensing_analyses SET status='waiting_configuration',error_message=NULL WHERE id=$1",[id]);
    return error("Copernicus Data Space is not configured yet. Add CDSE OAuth credentials in Infrastructure settings.",503,"REMOTE_SENSING_NOT_CONFIGURED");
  }

  await query("UPDATE remote_sensing_analyses SET status='running',error_message=NULL WHERE id=$1",[id]);

  try{
    const threshold=Number(row.vegetation_threshold);
    const areaHa=Number(row.aoi_area_ha);
    const [baselineScenes,comparisonScenes,baseline,comparison]=await Promise.all([
      searchSentinelScenes(row.aoi_geometry,row.baseline_date,Number(row.window_days),60),
      searchSentinelScenes(row.aoi_geometry,row.comparison_date,Number(row.window_days),60),
      fetchNdviStats(row.aoi_geometry,row.baseline_date,Number(row.window_days),threshold,areaHa),
      fetchNdviStats(row.aoi_geometry,row.comparison_date,Number(row.window_days),threshold,areaHa)
    ]);

    const quality=assessNdviQuality(baseline,comparison,Number(row.minimum_clear_fraction||0.6));
    if(!baselineScenes.length)quality.issues.push("No baseline Sentinel-2 scenes were discovered in the selected time window.");
    if(!comparisonScenes.length)quality.issues.push("No comparison Sentinel-2 scenes were discovered in the selected time window.");
    quality.publishable=quality.issues.length===0;

    const baselineHa=baseline.vegetationHa;
    const comparisonHa=comparison.vegetationHa;
    const changeHa=baselineHa!=null&&comparisonHa!=null?comparisonHa-baselineHa:null;
    const changePct=changeHa!=null&&baselineHa!=null&&baselineHa>0?(changeHa/baselineHa)*100:null;
    const level=changeLevel(changePct);

    await query(`
      UPDATE remote_sensing_analyses SET
        status=$15,quality_notes=$16,publish_to_map=CASE WHEN $15='completed' THEN publish_to_map ELSE FALSE END,
        baseline_mean_ndvi=$1,comparison_mean_ndvi=$2,
        baseline_clear_fraction=$3,comparison_clear_fraction=$4,
        baseline_vegetation_ha=$5,comparison_vegetation_ha=$6,
        vegetation_change_ha=$7,vegetation_change_pct=$8,change_level=$9,
        baseline_scene=$10,comparison_scene=$11,baseline_stats=$12,comparison_stats=$13,
        error_message=NULL,completed_at=now()
      WHERE id=$14
    `,[
      baseline.meanNdvi,comparison.meanNdvi,baseline.clearFraction,comparison.clearFraction,
      baselineHa,comparisonHa,changeHa,changePct,level,
      baselineScenes[0]?JSON.stringify(baselineScenes[0]):null,
      comparisonScenes[0]?JSON.stringify(comparisonScenes[0]):null,
      JSON.stringify(baseline.raw),JSON.stringify(comparison.raw),id,
      quality.publishable?"completed":"needs_review",quality.issues.join(" ")||null
    ]);

    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'run','remote_sensing_analysis',$2,$3)",[
      session.sub,id,JSON.stringify({baselineHa,comparisonHa,changeHa,changePct,changeLevel:level})
    ]);

    return NextResponse.json({data:{
      id,status:quality.publishable?"completed":"needs_review",quality,baseline,comparison,changeHa,changePct,changeLevel:level,
      baselineScene:baselineScenes[0]||null,comparisonScene:comparisonScenes[0]||null
    }});
  }catch(e){
    const message=e instanceof Error?e.message:"Remote-sensing analysis failed.";
    if(e instanceof NoSentinelObservationError){
      await query(`UPDATE remote_sensing_analyses SET status='needs_review',
        quality_notes=$1,error_message=NULL,publish_to_map=FALSE,
        baseline_mean_ndvi=NULL,comparison_mean_ndvi=NULL,
        baseline_clear_fraction=NULL,comparison_clear_fraction=NULL,
        baseline_vegetation_ha=NULL,comparison_vegetation_ha=NULL,
        vegetation_change_ha=NULL,vegetation_change_pct=NULL,
        completed_at=now()
        WHERE id=$2`,[message.slice(0,2000),id]);
      return NextResponse.json({data:{
        id,status:"needs_review",quality:{publishable:false,issues:[message]}
      }});
    }
    await query("UPDATE remote_sensing_analyses SET status='failed',error_message=$1,publish_to_map=FALSE WHERE id=$2",
      [message.slice(0,2000),id]);
    return error(message,502,"REMOTE_SENSING_FAILED");
  }
}
