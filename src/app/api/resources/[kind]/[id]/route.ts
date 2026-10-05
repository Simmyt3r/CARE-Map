import {NextResponse} from "next/server";
import {getSession,isAdmin,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {isResourceKind,patchResource} from "@/lib/resources";
import {query} from "@/lib/db";
export const runtime="nodejs";
export async function PATCH(request:Request,context:{params:Promise<{kind:string;id:string}>}){
 const{kind,id}=await context.params;if(!isResourceKind(kind))return error("Unknown resource",404);
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return error("Invalid JSON body");
 try{const updated=await patchResource(kind,id,body,session.sub);if(!updated)return error("Nothing to update",400);
 await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'update',$2,$3,$4)",[session.sub,kind,id,JSON.stringify({fields:Object.keys(body)})]);return NextResponse.json({data:updated});}
 catch(e){return error(e instanceof Error?e.message:"Unable to update resource",400);}
}
export async function DELETE(_:Request,context:{params:Promise<{kind:string;id:string}>}){
 const{kind,id}=await context.params;if(!isResourceKind(kind))return error("Unknown resource",404);
 const session=await getSession();if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
 const table=kind==="forest-sites"?"forest_sites":kind;await query("DELETE FROM "+table+" WHERE id=$1",[id]);
 await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'delete',$2,$3)",[session.sub,kind,id]);return NextResponse.json({ok:true});
}
