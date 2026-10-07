import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {
  acceptanceFinalResult,
  canCompleteAcceptance,
  isAcceptanceCheckStatus,
  type AcceptanceCheckStatus
} from "@/lib/field-acceptance";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!uuid.test(id))return error("Invalid acceptance run ID.");

  const run=await query(`
    SELECT r.*,l.name lga_name,l.pilot,u.name created_by_name
    FROM field_acceptance_runs r
    JOIN lgas l ON l.code=r.lga_code
    LEFT JOIN users u ON u.id=r.created_by
    WHERE r.id=$1
  `,[id]);
  if(!run.rowCount)return error("Field acceptance run not found.",404);

  const [checks,evidence]=await Promise.all([
    query(`
      SELECT c.*,u.name tested_by_name,
        (SELECT count(*) FROM field_acceptance_evidence e WHERE e.run_id=c.run_id AND e.check_key=c.check_key)::int evidence_count
      FROM field_acceptance_checks c
      LEFT JOIN users u ON u.id=c.tested_by
      WHERE c.run_id=$1
      ORDER BY c.sort_order,c.label
    `,[id]),
    query(`
      SELECT e.id,e.check_key,e.url,e.caption,e.uploaded_at,u.name uploaded_by_name
      FROM field_acceptance_evidence e
      LEFT JOIN users u ON u.id=e.uploaded_by
      WHERE e.run_id=$1
      ORDER BY e.uploaded_at DESC
    `,[id])
  ]);

  return NextResponse.json({data:{...run.rows[0],checks:checks.rows,evidence:evidence.rows}});
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!uuid.test(id))return error("Invalid acceptance run ID.");

  const body=await request.json().catch(()=>null) as {
    checkKey?:string;status?:AcceptanceCheckStatus;checkNotes?:string|null;
    notes?:string|null;complete?:boolean;reopen?:boolean;
  }|null;
  if(!body)return error("Invalid request body.");

  const requestedCheckKey=body.checkKey===undefined?null:String(body.checkKey).trim();
  if(body.checkKey!==undefined&&!requestedCheckKey)return error("Check key is required.");
  if(body.checkKey!==undefined&&!isAcceptanceCheckStatus(body.status))return error("Invalid field acceptance check status.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const run=await client.query<{status:string;result:string}>(
      "SELECT status,result FROM field_acceptance_runs WHERE id=$1 FOR UPDATE",[id]
    );
    if(!run.rowCount){
      await client.query("ROLLBACK");
      return error("Field acceptance run not found.",404);
    }

    const events:Record<string,unknown>={};

    if(body.reopen){
      await client.query(`
        UPDATE field_acceptance_runs
        SET status='in_progress',result='pending',completed_at=NULL,updated_by=$2
        WHERE id=$1
      `,[id,session.sub]);
      events.reopened=true;
    }

    if(body.checkKey!==undefined){
      if(run.rows[0].status==="completed"&&!body.reopen){
        await client.query("ROLLBACK");
        return error("Reopen the completed run before changing check results.",409,"RUN_COMPLETED");
      }
      const key=requestedCheckKey as string;
      const status=body.status as AcceptanceCheckStatus;
      const notes=body.checkNotes==null?null:String(body.checkNotes).trim().slice(0,3000)||null;
      const updated=await client.query(`
        UPDATE field_acceptance_checks
        SET status=$3,notes=$4,
          tested_at=CASE WHEN $3='not_run' THEN NULL ELSE now() END,
          tested_by=CASE WHEN $3='not_run' THEN NULL ELSE $5::uuid END
        WHERE run_id=$1 AND check_key=$2
        RETURNING check_key,status
      `,[id,key,status,notes,session.sub]);
      if(!updated.rowCount){
        await client.query("ROLLBACK");
        return error("Acceptance check not found.",404);
      }
      events.checkKey=key;events.checkStatus=status;
    }

    if(body.notes!==undefined){
      const notes=body.notes==null?null:String(body.notes).trim().slice(0,3000)||null;
      await client.query("UPDATE field_acceptance_runs SET notes=$2,updated_by=$3 WHERE id=$1",[id,notes,session.sub]);
      events.notesUpdated=true;
    }

    if(body.complete){
      const checks=await client.query<{status:AcceptanceCheckStatus;required:boolean}>(
        "SELECT status,required FROM field_acceptance_checks WHERE run_id=$1 ORDER BY sort_order",[id]
      );
      if(!canCompleteAcceptance(checks.rows)){
        await client.query("ROLLBACK");
        return error("Complete every required check before finishing this acceptance run.",409,"CHECKS_INCOMPLETE");
      }
      const result=acceptanceFinalResult(checks.rows);
      await client.query(`
        UPDATE field_acceptance_runs
        SET status='completed',result=$2,completed_at=now(),updated_by=$3
        WHERE id=$1
      `,[id,result,session.sub]);
      events.completed=true;events.result=result;
    }

    if(Object.keys(events).length===0){
      await client.query("ROLLBACK");
      return error("Nothing to update.");
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'field_acceptance_update','field_acceptance',$2,$3)",
      [session.sub,id,JSON.stringify(events)]
    );
    await client.query("COMMIT");

    const updatedRun=await query(
      "SELECT id,status,result,completed_at,updated_at FROM field_acceptance_runs WHERE id=$1",[id]
    );
    return NextResponse.json({data:updatedRun.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Field acceptance update failed.",400);
  }finally{
    client.release();
  }
}
