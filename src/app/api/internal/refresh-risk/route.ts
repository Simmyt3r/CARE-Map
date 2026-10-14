import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {RISK_REFRESH_SQL} from "@/lib/risk-refresh";
export const runtime="nodejs";export const dynamic="force-dynamic";
function authorized(request:Request){const secret=process.env.CRON_SECRET;return!!secret&&request.headers.get("authorization")==="Bearer "+secret;}
export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:"unauthorized"},{status:401});
 try{
   await query(RISK_REFRESH_SQL);
   return NextResponse.json({ok:true,refreshedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
   // Do not return SQL, connection details or personally identifying records.
   const code=(e&&typeof e==="object"&&"code" in e)?String(e.code):"UNKNOWN";
   console.error("Risk refresh failed", {code});
   return NextResponse.json({ok:false,error:"Scheduled risk and retention maintenance could not finish."},
     {status:503,headers:{"Cache-Control":"no-store"}});
 }


}
