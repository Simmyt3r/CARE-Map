import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {fieldVerificationClosureError} from "@/lib/satellite-verification";

const allowed=new Set(["submitted","under_review","verified","resolved","rejected"]);

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {status?:string;notes?:string}|null;
  if(!body?.status||!allowed.has(body.status))return error("Invalid report status");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const current=await client.query<{status:string;origin:string}>("SELECT status,origin FROM reports WHERE id=$1 FOR UPDATE",[id]);
    if(!current.rowCount){
      await client.query("ROLLBACK");
      return error("Report not found",404);
    }

    const fromStatus=current.rows[0].status;
    const origin=current.rows[0].origin;

    let evidenceCount=0;
    if(origin==="satellite_alert"&&body.status==="resolved"){
      const evidence=await client.query("SELECT count(*)::int count FROM photos WHERE entity_type='report' AND entity_id=$1",[id]);
      evidenceCount=Number(evidence.rows[0]?.count||0);
    }
    const closureError=fieldVerificationClosureError({origin,status:body.status,note:body.notes,evidenceCount});
    if(closureError){
      await client.query("ROLLBACK");
      return error(closureError,400);
    }

    const result=await client.query(
      `UPDATE reports
       SET status=$1,
           resolution_notes=COALESCE($2,resolution_notes),
           resolved_at=CASE
             WHEN $1='resolved' THEN COALESCE(resolved_at,now())
             WHEN $1<>'resolved' THEN NULL
             ELSE resolved_at
           END
       WHERE id=$3
       RETURNING id,status,resolved_at`,
      [body.status,body.notes||null,id]
    );

    if(fromStatus!==body.status||body.notes){
      await client.query(
        "INSERT INTO report_status_history(report_id,from_status,to_status,note,actor_id) VALUES($1,$2,$3,$4,$5)",
        [id,fromStatus,body.status,body.notes||null,session.sub]
      );
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'status_change','report',$2,$3)",
      [session.sub,id,JSON.stringify({from:fromStatus,to:body.status,note:body.notes||null})]
    );

    if(body.status==="resolved"||body.status==="rejected"){
      await client.query(
        `UPDATE vegetation_alerts
         SET acknowledged_at=COALESCE(acknowledged_at,now()),
             acknowledged_by=COALESCE(acknowledged_by,$1)
         WHERE verification_report_id=$2`,
        [session.sub,id]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({data:result.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Unable to change report status.",400);
  }finally{
    client.release();
  }
}
