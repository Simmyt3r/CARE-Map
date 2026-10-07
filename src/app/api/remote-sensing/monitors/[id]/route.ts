import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {
    active?:boolean;cadenceDays?:number;minimumClearFraction?:number;alertLossPct?:number
  }|null;
  if(!body)return error("Invalid request body.");

  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};
  if(body.active!==undefined){
    params.push(body.active);sets.push("active=$"+params.length);metadata.active=body.active;
    if(body.active)sets.push("next_due_at=LEAST(next_due_at,now())");
  }
  if(body.cadenceDays!==undefined){
    const value=Number(body.cadenceDays);
    if(!Number.isFinite(value)||value<1||value>90)return error("Cadence must be between 1 and 90 days.");
    params.push(Math.round(value));sets.push("cadence_days=$"+params.length);metadata.cadenceDays=Math.round(value);
  }
  if(body.minimumClearFraction!==undefined){
    const value=Number(body.minimumClearFraction);
    if(!Number.isFinite(value)||value<0||value>1)return error("Minimum clear coverage must be between 0 and 1.");
    params.push(value);sets.push("minimum_clear_fraction=$"+params.length);metadata.minimumClearFraction=value;
  }
  if(body.alertLossPct!==undefined){
    const value=Number(body.alertLossPct);
    if(!Number.isFinite(value)||value<0.1||value>100)return error("Alert loss threshold must be between 0.1 and 100 percent.");
    params.push(value);sets.push("alert_loss_pct=$"+params.length);metadata.alertLossPct=value;
  }
  if(!sets.length)return error("Nothing to update.");

  params.push(id);
  const result=await query("UPDATE vegetation_monitors SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,active,cadence_days,minimum_clear_fraction,alert_loss_pct,next_due_at",params);
  if(!result.rowCount)return error("Vegetation monitor not found",404);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'update','vegetation_monitor',$2,$3)",[
    session.sub,id,JSON.stringify(metadata)
  ]);
  return NextResponse.json({data:result.rows[0]});
}
