import {NextResponse} from "next/server";
import {getSession,isAdmin,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {planStatewideJob,stateBoundaryReadiness,statewideOverview,validateStatewideOptions} from "@/lib/statewide-ndvi";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  try{
    const [readiness,jobs]=await Promise.all([stateBoundaryReadiness(),statewideOverview()]);
    return NextResponse.json({data:{readiness,jobs},admin:isAdmin(session)},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return error("State-wide Sentinel tables are unavailable. An administrator must apply the pending database migration.",503,"SCHEMA_PENDING");
  }
}
export async function POST(request:Request){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator approval is required for state-wide processing.",403,"FORBIDDEN");
  if(request.headers.get("origin")!==new URL(request.url).origin)
    return error("Invalid request origin.",403,"INVALID_ORIGIN");
  const raw=await request.text();
  if(raw.length>3000)return error("Request too large.",413);
  let x:{baselineDate:string;comparisonDate:string;windowDays:number;threshold:number}|null=null;
  try{x=JSON.parse(raw);}catch{return error("Invalid request JSON.",400);}
  if(!x)return error("State-wide analysis options are required.");
  try{
    validateStatewideOptions(x);
    const result=await planStatewideJob(x,session.sub);
    return NextResponse.json({data:result},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(e){
    const msg=e instanceof Error?e.message:"State-wide analysis could not be planned.";
    if(/already active/i.test(msg))return error(msg,409,"ALREADY_RUNNING");
    return error(msg,422,"STATEWIDE_PLAN_FAILED");
  }
}
