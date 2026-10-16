import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {runNextStatewideTile} from "@/lib/statewide-ndvi";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getSession();
 if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
   return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const{id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return error("Invalid state-wide job ID.");
 try{
   const result=await runNextStatewideTile(id);
   return NextResponse.json({data:result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
   const msg=e instanceof Error?e.message:"The next Sentinel tile could not be processed.";
   return error(msg,503,"STATEWIDE_TILE_FAILED");
 }
}
