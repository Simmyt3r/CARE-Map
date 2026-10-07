import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {remoteSensingConfigured} from "@/lib/remote-sensing";
import {runVegetationMonitor} from "@/lib/vegetation-monitoring";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret)&&request.headers.get("authorization")==="Bearer "+secret;
}

export async function GET(request:Request){
  if(!authorized(request))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!remoteSensingConfigured()){
    return NextResponse.json({ok:true,skipped:"Copernicus Data Space OAuth is not configured.",processed:0});
  }

  const due=await query<{id:string;name:string}>(`
    SELECT id,name FROM vegetation_monitors
    WHERE active=TRUE AND next_due_at<=now()
    ORDER BY next_due_at
    LIMIT 5
  `);

  const results:{id:string;name:string;ok:boolean;status?:string;alertId?:string|null;error?:string}[]=[];
  for(const monitor of due.rows){
    try{
      const run=await runVegetationMonitor(monitor.id,null);
      results.push({id:monitor.id,name:monitor.name,ok:true,status:run.status,alertId:run.alertId});
    }catch(e){
      results.push({id:monitor.id,name:monitor.name,ok:false,error:e instanceof Error?e.message:"Monitoring failed."});
    }
  }

  return NextResponse.json({ok:true,processed:results.length,results,checkedAt:new Date().toISOString()});
}
