import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {fetchNdviPreview,type RemoteSensingRow} from "@/lib/remote-sensing";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const period=new URL(request.url).searchParams.get("period");
  if(period!=="baseline"&&period!=="comparison")return error("period must be baseline or comparison.");

  const result=await query<RemoteSensingRow>(`
    SELECT r.*,ST_AsGeoJSON(r.aoi)::json aoi_geometry,ST_Area(r.aoi::geography)/10000.0 aoi_area_ha
    FROM remote_sensing_analyses r WHERE r.id=$1
  `,[id]);
  const row=result.rows[0];
  if(!row)return error("Analysis not found",404);

  try{
    const date=period==="baseline"?row.baseline_date:row.comparison_date;
    const image=await fetchNdviPreview(row.aoi_geometry,date,Number(row.window_days));
    return new Response(image,{headers:{"content-type":"image/png","cache-control":"private, max-age=3600"}});
  }catch(e){
    return error(e instanceof Error?e.message:"Could not generate NDVI preview.",400);
  }
}
