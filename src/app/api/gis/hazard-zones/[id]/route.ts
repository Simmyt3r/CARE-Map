import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {isHazardSeverity} from "@/lib/hazard-zones";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return error("Invalid hazard zone ID.");

  const body=await request.json().catch(()=>null) as {
    verified?:boolean;severity?:string;name?:string;method?:string|null;notes?:string|null;
  }|null;
  if(!body)return error("Invalid request body.");

  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};

  if(body.verified!==undefined){
    params.push(Boolean(body.verified));const p=params.length;
    sets.push("verified=$"+p);
    if(body.verified){
      params.push(session.sub);
      sets.push("verified_at=now()","verified_by=$"+params.length);
    }else{
      sets.push("verified_at=NULL","verified_by=NULL");
    }
    metadata.verified=Boolean(body.verified);
  }

  if(body.severity!==undefined){
    const severity=String(body.severity).trim().toLowerCase();
    if(!isHazardSeverity(severity))return error("Invalid hazard severity.");
    params.push(severity);sets.push("severity=$"+params.length);metadata.severity=severity;
  }
  if(body.name!==undefined){
    const name=String(body.name).trim().slice(0,220);
    if(!name)return error("Hazard zone name cannot be empty.");
    params.push(name);sets.push("name=$"+params.length);metadata.name=name;
  }
  if(body.method!==undefined){
    params.push(body.method==null?null:String(body.method).trim().slice(0,300)||null);
    sets.push("method=$"+params.length);
  }
  if(body.notes!==undefined){
    params.push(body.notes==null?null:String(body.notes).trim().slice(0,3000)||null);
    sets.push("notes=$"+params.length);
  }
  if(!sets.length)return error("Nothing to update.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    params.push(session.sub);sets.push("updated_by=$"+params.length);
    params.push(id);
    const result=await client.query(
      "UPDATE hazard_zones SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,name,hazard_type,severity,verified,verified_at",
      params
    );
    if(!result.rowCount){
      await client.query("ROLLBACK");
      return error("Hazard zone not found.",404);
    }
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'hazard_zone_update','hazard_zone',$2,$3)",
      [session.sub,id,JSON.stringify(metadata)]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:result.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Hazard zone update failed.",400);
  }finally{
    client.release();
  }
}
