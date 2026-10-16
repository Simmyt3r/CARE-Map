import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {requeueProviderLimitedTiles} from "@/lib/statewide-ndvi";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

/**
 * Reopen a blocked state-wide job ONLY after a human confirms that provider
 * processing credits/request quota are available. Never launch imagery from
 * this endpoint, and never reset completed/quality-review observations.
 */
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getSession();
 if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
   return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return error("Invalid state-wide job ID.",400);
 const raw=await request.text();
 if(raw.length>1000)return error("Request too large.",413);
 let body:{providerQuotaConfirmed?:boolean}|null=null;
 try{body=JSON.parse(raw);}catch{return error("Invalid JSON.",400);}
 if(body?.providerQuotaConfirmed!==true)
   return error("Confirm that Copernicus processing credits or rate limits have been reviewed before resuming.",400);
 try{
   const result=await requeueProviderLimitedTiles(id);
   return NextResponse.json({data:result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
   return error(e instanceof Error?e.message:"Unable to resume limited tiles.",409,"REQUEUE_UNAVAILABLE");
 }
}
