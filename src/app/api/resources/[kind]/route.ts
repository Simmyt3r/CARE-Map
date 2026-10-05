import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {createResource,isResourceKind,listResources} from "@/lib/resources";
import {query} from "@/lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{kind:string}>}){
 const{kind}=await context.params;if(!isResourceKind(kind))return error("Unknown resource",404);
 const session=await getSession();const url=new URL(request.url);
 const rows=await listResources(kind,{lga:url.searchParams.get("lga"),status:url.searchParams.get("status"),includeUnverified:isStaff(session)});
 return NextResponse.json({data:rows,total:rows.length});
}
export async function POST(request:Request,context:{params:Promise<{kind:string}>}){
 const{kind}=await context.params;if(!isResourceKind(kind))return error("Unknown resource",404);
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return error("Invalid JSON body",400);
 try{const created=await createResource(kind,body,session.sub);await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'create',$2,$3)",[session.sub,kind,created.id]);return NextResponse.json({data:created},{status:201});}
 catch(e){return error(e instanceof Error?e.message:"Unable to create resource",400);}
}
