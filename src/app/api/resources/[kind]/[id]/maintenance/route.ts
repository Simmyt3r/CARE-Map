import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
export const runtime="nodejs";
export async function GET(_:Request,context:{params:Promise<{kind:string;id:string}>}){
 const{kind,id}=await context.params;if(!["boreholes","assets"].includes(kind))return error("Maintenance is only supported for boreholes and assets",400);
 const entityType=kind==="boreholes"?"borehole":"asset";const result=await query("SELECT * FROM maintenance_records WHERE entity_type=$1 AND entity_id=$2 ORDER BY performed_at DESC",[entityType,id]);
 return NextResponse.json({data:result.rows});
}
export async function POST(request:Request,context:{params:Promise<{kind:string;id:string}>}){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const{kind,id}=await context.params;if(!["boreholes","assets"].includes(kind))return error("Maintenance is only supported for boreholes and assets",400);
 const body=await request.json().catch(()=>null) as {performedAt?:string;notes?:string}|null;if(!body?.performedAt)return error("performedAt is required");
 const entityType=kind==="boreholes"?"borehole":"asset";await query("INSERT INTO maintenance_records(entity_type,entity_id,performed_at,notes,performed_by) VALUES($1,$2,$3,$4,$5)",[entityType,id,body.performedAt,body.notes||null,session.sub]);
 await query("UPDATE "+kind+" SET last_maintenance_date=$1,updated_by=$2 WHERE id=$3",[body.performedAt,session.sub,id]);return NextResponse.json({ok:true},{status:201});
}
