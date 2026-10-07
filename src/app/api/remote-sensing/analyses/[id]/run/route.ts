import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {
  changeLevel,fetchNdviStats,remoteSensingConfigured,searchSentinelScenes,
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

    const baselineHa=baseline.vegetationHa;
    const comparisonHa=comparison.vegetationHa;
    const changeHa=baselineHa!=null&&comparisonHa!=null?comparisonHa-baselineHa:null;
    const changePct=changeHa!=null&&baselineHa!=null&&baselineHa>0?(changeHa/baselineHa)*100:null;
    const level=changeLevel(changePct);

    await query(`
      UPDATE remote_sensing_analyses SET
        status='completed',
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
      JSON.stringify(baseline.raw),JSON.stringify(comparison.raw),id
    ]);

    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'run','remote_sensing_analysis',$2,$3)",[
      session.sub,id,JSON.stringify({baselineHa,comparisonHa,changeHa,changePct,changeLevel:level})
    ]);

    return NextResponse.json({data:{
      id,status:"completed",baseline,comparison,changeHa,changePct,changeLevel:level,
      baselineScene:baselineScenes[0]||null,comparisonScene:comparisonScenes[0]||null
    }});
  }catch(e){
    const message=e instanceof Error?e.message:"Remote-sensing analysis failed.";
    await query("UPDATE remote_sensing_analyses SET status='failed',error_message=$1 WHERE id=$2",[message.slice(0,2000),id]);
    return error(message,400,"REMOTE_SENSING_FAILED");
  }
}
