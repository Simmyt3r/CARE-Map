import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
const allowed=new Set(["under_review","verified","resolved","rejected"]);
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const{id}=await context.params;const body=await request.json().catch(()=>null) as {status?:string;notes?:string}|null;if(!body?.status||!allowed.has(body.status))return error("Invalid report status");
 const resolved=body.status==="resolved"?"now()":"resolved_at";
 const result=await query("UPDATE reports SET status=$1,resolution_notes=COALESCE($2,resolution_notes),resolved_at="+resolved+" WHERE id=$3 RETURNING id,status",[body.status,body.notes||null,id]);
 if(!result.rowCount)return error("Report not found",404);await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'status_change','report',$2,$3)",[session.sub,id,JSON.stringify({status:body.status})]);
 return NextResponse.json({data:result.rows[0]});
}
