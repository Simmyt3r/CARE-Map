import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import type {RemoteSensingRow} from "@/lib/remote-sensing";

export const dynamic="force-dynamic";

async function load(id:string){
  const result=await query<RemoteSensingRow>(`
    SELECT r.*,
      ST_AsGeoJSON(r.aoi)::json aoi_geometry,
      ST_Area(r.aoi::geography)/10000.0 aoi_area_ha
    FROM remote_sensing_analyses r WHERE r.id=$1
  `,[id]);
  return result.rows[0]||null;
}

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const row=await load(id);
  if(!row)return error("Analysis not found",404);
  return NextResponse.json({data:row});
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {publishToMap?:boolean}|null;
  if(typeof body?.publishToMap!=="boolean")return error("publishToMap must be true or false.");
  const result=await query(
    "UPDATE remote_sensing_analyses SET publish_to_map=$1 WHERE id=$2 RETURNING id,publish_to_map",
    [body.publishToMap,id]
  );
  if(!result.rowCount)return error("Analysis not found",404);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'publish_update','remote_sensing_analysis',$2,$3)",[
    session.sub,id,JSON.stringify({publishToMap:body.publishToMap})
  ]);
  return NextResponse.json({data:result.rows[0]});
}
