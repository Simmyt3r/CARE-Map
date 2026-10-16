import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {statewideLgaSummary,statewideOverview} from "@/lib/statewide-ndvi";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getSession();
 if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return error("Invalid analysis job ID.");
 const jobs=await statewideOverview();
 const job=jobs.find(j=>j.id===id);
 if(!job)return error("State-wide analysis not found.",404);
 const lgas=await statewideLgaSummary(id);
 return NextResponse.json({data:{job,lgas}},{headers:{"Cache-Control":"no-store"}});
}
