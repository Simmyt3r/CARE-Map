import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return error("Invalid breach record ID.");

  const body=await request.json().catch(()=>null) as {
    status?:string;containmentActions?:string|null;ndpcNotified?:boolean;subjectsNotified?:boolean;
    likelyRisk?:boolean;highRisk?:boolean;
  }|null;
  if(!body)return error("Invalid request body.");

  const sets:string[]=[];const params:unknown[]=[];const meta:Record<string,unknown>={};
  if(body.status!==undefined){
    const status=String(body.status).trim();
    if(!["open","contained","closed"].includes(status))return error("Invalid breach status.");
    params.push(status);sets.push("status=$"+params.length);meta.status=status;
  }
  if(body.containmentActions!==undefined){
    params.push(body.containmentActions==null?null:String(body.containmentActions).trim().slice(0,5000)||null);
    sets.push("containment_actions=$"+params.length);
  }
  if(body.likelyRisk!==undefined){
    params.push(Boolean(body.likelyRisk));sets.push("likely_risk=$"+params.length,"ndpc_notification_required=$"+params.length);meta.likelyRisk=Boolean(body.likelyRisk);
  }
  if(body.highRisk!==undefined){
    const high=Boolean(body.highRisk);
    params.push(high);sets.push("high_risk=$"+params.length,"subjects_notification_required=$"+params.length);meta.highRisk=high;
    if(high)sets.push("likely_risk=TRUE","ndpc_notification_required=TRUE");
  }
  if(body.ndpcNotified===true){sets.push("ndpc_notified_at=COALESCE(ndpc_notified_at,now())");meta.ndpcNotified=true;}
  if(body.subjectsNotified===true){sets.push("subjects_notified_at=COALESCE(subjects_notified_at,now())");meta.subjectsNotified=true;}
  if(!sets.length)return error("Nothing to update.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    params.push(session.sub);sets.push("updated_by=$"+params.length);
    params.push(id);
    const updated=await client.query(
      "UPDATE privacy_breach_register SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,status,detected_at,likely_risk,high_risk,ndpc_notified_at,subjects_notified_at",
      params
    );
    if(!updated.rowCount){await client.query("ROLLBACK");return error("Breach record not found.",404);}
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'privacy_breach_update','privacy_breach',$2,$3)",
      [session.sub,id,JSON.stringify(meta)]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:updated.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Breach update failed.",400);
  }finally{client.release();}
}
