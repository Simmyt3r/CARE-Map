import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {isDataSubjectRequestStatus} from "@/lib/privacy";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return error("Invalid privacy request ID.");

  const body=await request.json().catch(()=>null) as {
    status?:string;assignedTo?:string|null;verificationNotes?:string|null;resolutionNotes?:string|null;
  }|null;
  if(!body)return error("Invalid request body.");

  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};

  if(body.status!==undefined){
    const status=String(body.status).trim();
    if(!isDataSubjectRequestStatus(status))return error("Invalid privacy request status.");
    params.push(status);sets.push("status=$"+params.length);
    sets.push("completed_at="+(status==="completed"||status==="rejected"?"COALESCE(completed_at,now())":"NULL"));
    metadata.status=status;
  }
  if(body.assignedTo!==undefined){
    const assigned=body.assignedTo&&String(body.assignedTo).trim()?String(body.assignedTo).trim():null;
    if(assigned&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assigned))return error("Invalid assignee.");
    params.push(assigned);sets.push("assigned_to=$"+params.length);metadata.assignedTo=assigned;
  }
  if(body.verificationNotes!==undefined){
    params.push(body.verificationNotes==null?null:String(body.verificationNotes).trim().slice(0,4000)||null);
    sets.push("verification_notes=$"+params.length);
  }
  if(body.resolutionNotes!==undefined){
    params.push(body.resolutionNotes==null?null:String(body.resolutionNotes).trim().slice(0,5000)||null);
    sets.push("resolution_notes=$"+params.length);
  }
  if(!sets.length)return error("Nothing to update.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    params.push(id);
    const updated=await client.query(
      "UPDATE data_subject_requests SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,reference_code,status,due_at,completed_at",
      params
    );
    if(!updated.rowCount){
      await client.query("ROLLBACK");
      return error("Privacy request not found.",404);
    }
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'privacy_request_update','data_subject_request',$2,$3)",
      [session.sub,id,JSON.stringify(metadata)]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:updated.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Privacy request update failed.",400);
  }finally{
    client.release();
  }
}
