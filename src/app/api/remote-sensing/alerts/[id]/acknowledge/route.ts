import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export async function POST(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const result=await query(
    "UPDATE vegetation_alerts SET acknowledged_at=COALESCE(acknowledged_at,now()),acknowledged_by=COALESCE(acknowledged_by,$1) WHERE id=$2 RETURNING id,acknowledged_at",
    [session.sub,id]
  );
  if(!result.rowCount)return error("Vegetation alert not found",404);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'acknowledge','vegetation_alert',$2)",[session.sub,id]);
  return NextResponse.json({data:result.rows[0]});
}
