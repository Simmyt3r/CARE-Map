import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {runVegetationMonitor} from "@/lib/vegetation-monitoring";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function POST(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  try{
    const result=await runVegetationMonitor(id,session.sub);
    return NextResponse.json({data:result});
  }catch(e){
    return error(e instanceof Error?e.message:"Vegetation monitoring failed.",400,"MONITOR_RUN_FAILED");
  }
}
