import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {verified?:boolean}|null;
  if(!body||typeof body.verified!=="boolean")return error("verified must be true or false.");

  const result=await query<{id:string;verified:boolean}>(
    "UPDATE environmental_risk_zones SET verified=$1,updated_by=$2 WHERE id=$3 RETURNING id,verified",
    [body.verified,session.sub,id]
  );
  if(!result.rowCount)return error("Risk zone not found.",404);

  await query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'risk_zone_verification','environmental_risk_zone',$2,$3)",
    [session.sub,id,JSON.stringify({verified:body.verified})]
  );
  return NextResponse.json({data:result.rows[0]});
}
