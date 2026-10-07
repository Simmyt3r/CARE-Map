import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {normalizeAoi,searchSentinelScenes} from "@/lib/remote-sensing";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const body=await request.json().catch(()=>null) as {geometry?:unknown;date?:string;windowDays?:number;maxCloud?:number}|null;
  if(!body?.geometry||!body.date)return error("AOI geometry and date are required.");
  try{
    const aoi=normalizeAoi(body.geometry);
    const windowDays=Math.min(30,Math.max(1,Number(body.windowDays||7)));
    const maxCloud=Math.min(100,Math.max(1,Number(body.maxCloud||40)));
    const scenes=await searchSentinelScenes(aoi,body.date,windowDays,maxCloud);
    return NextResponse.json({data:scenes,total:scenes.length});
  }catch(e){
    return error(e instanceof Error?e.message:"Scene search failed.",400);
  }
}
