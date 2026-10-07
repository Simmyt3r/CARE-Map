import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {normalizeAoi,remoteSensingConfigured,searchSentinelScenes} from "@/lib/remote-sensing";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const result=await query(`
    SELECT r.id,r.name,r.baseline_date,r.comparison_date,r.window_days,r.vegetation_threshold,
           r.status,r.baseline_mean_ndvi,r.comparison_mean_ndvi,r.baseline_clear_fraction,r.comparison_clear_fraction,
           r.baseline_vegetation_ha,r.comparison_vegetation_ha,r.vegetation_change_ha,r.vegetation_change_pct,
           r.change_level,r.publish_to_map,r.error_message,r.created_at,r.completed_at,
           round((ST_Area(r.aoi::geography)/10000.0)::numeric,2) aoi_area_ha,
           u.name created_by_name
    FROM remote_sensing_analyses r
    LEFT JOIN users u ON u.id=r.created_by
    ORDER BY r.created_at DESC LIMIT 200
  `);
  return NextResponse.json({data:result.rows,configured:remoteSensingConfigured()});
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    name?:string;geometry?:unknown;baselineDate?:string;comparisonDate?:string;windowDays?:number;threshold?:number;
  }|null;
  if(!body?.name?.trim()||!body.geometry||!body.baselineDate||!body.comparisonDate)return error("Name, AOI and both comparison dates are required.");
  const windowDays=Math.min(30,Math.max(1,Number(body.windowDays||7)));
  const threshold=Number(body.threshold??0.3);
  if(!Number.isFinite(threshold)||threshold< -1||threshold>1)return error("Vegetation threshold must be between -1 and 1.");
  if(Number.isNaN(Date.parse(body.baselineDate))||Number.isNaN(Date.parse(body.comparisonDate)))return error("Valid comparison dates are required.");
  if(new Date(body.comparisonDate)<=new Date(body.baselineDate))return error("Comparison date must be after baseline date.");

  try{
    const aoi=normalizeAoi(body.geometry);
    const [baselineScenes,comparisonScenes]=await Promise.all([
      searchSentinelScenes(aoi,body.baselineDate,windowDays,60),
      searchSentinelScenes(aoi,body.comparisonDate,windowDays,60)
    ]);
    const status=remoteSensingConfigured()?"draft":"waiting_configuration";
    const result=await query<{id:string}>(
      `INSERT INTO remote_sensing_analyses(
        name,aoi,baseline_date,comparison_date,window_days,vegetation_threshold,status,
        baseline_scene,comparison_scene,created_by
      ) VALUES(
        $1,ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($2),4326))),3)),$3,$4,$5,$6,$7,$8,$9,$10
      ) RETURNING id`,
      [
        body.name.trim().slice(0,180),
        JSON.stringify(aoi),
        body.baselineDate,
        body.comparisonDate,
        windowDays,
        threshold,
        status,
        baselineScenes[0]?JSON.stringify(baselineScenes[0]):null,
        comparisonScenes[0]?JSON.stringify(comparisonScenes[0]):null,
        session.sub
      ]
    );
    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create','remote_sensing_analysis',$2,$3)",[
      session.sub,result.rows[0].id,JSON.stringify({baselineDate:body.baselineDate,comparisonDate:body.comparisonDate,windowDays,threshold})
    ]);
    return NextResponse.json({data:{id:result.rows[0].id,status,baselineScenes,comparisonScenes}},{status:201});
  }catch(e){
    return error(e instanceof Error?e.message:"Could not create remote-sensing analysis.",400);
  }
}
