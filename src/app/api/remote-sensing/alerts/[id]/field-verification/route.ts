import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {fieldVerificationDueAt} from "@/lib/satellite-verification";

type AlertRow={
  id:string;
  severity:"medium"|"high"|"critical";
  title:string;
  message:string;
  vegetation_change_ha:number|string|null;
  vegetation_change_pct:number|string|null;
  verification_report_id:string|null;
  monitor_name:string;
  observed_for:string;
  latitude:number;
  longitude:number;
};

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>({})) as {assignedTo?:string|null;dueAt?:string|null};

  if(body.dueAt&&Number.isNaN(Date.parse(body.dueAt)))return error("Invalid due date.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");

    const alert=await client.query<AlertRow>(`
      SELECT a.id,a.severity,a.title,a.message,a.vegetation_change_ha,a.vegetation_change_pct,
             a.verification_report_id,m.name monitor_name,o.observed_for,
             ST_Y(ST_PointOnSurface(m.aoi)) latitude,
             ST_X(ST_PointOnSurface(m.aoi)) longitude
      FROM vegetation_alerts a
      JOIN vegetation_monitors m ON m.id=a.monitor_id
      JOIN vegetation_monitor_observations o ON o.id=a.observation_id
      WHERE a.id=$1
      FOR UPDATE OF a
    `,[id]);

    if(!alert.rowCount){
      await client.query("ROLLBACK");
      return error("Vegetation alert not found",404);
    }

    const a=alert.rows[0];
    if(a.verification_report_id){
      await client.query("COMMIT");
      return NextResponse.json({data:{reportId:a.verification_report_id,created:false}});
    }

    if(body.assignedTo){
      const staff=await client.query(
        "SELECT id FROM users WHERE id=$1 AND role IN ('staff','admin') AND active=TRUE AND deleted_at IS NULL",
        [body.assignedTo]
      );
      if(!staff.rowCount){
        await client.query("ROLLBACK");
        return error("Assigned user must be an active staff member.",400);
      }
    }

    const dueAt=body.dueAt||fieldVerificationDueAt(a.severity).toISOString();
    const priority=a.severity;
    const description=
      "Satellite vegetation alert requires field verification.\n\n"+
      a.message+"\n\n"+
      "Monitor: "+a.monitor_name+"\n"+
      "Satellite observation: "+String(a.observed_for).slice(0,10)+"\n"+
      "Field objective: visit the AOI, confirm whether vegetation loss is genuine, record observations, capture geotagged evidence photos, and document likely cause and recommended action.";

    const report=await client.query<{id:string}>(`
      INSERT INTO reports(
        type,submitted_by,description,location,status,priority,assigned_to,assigned_at,due_at,
        capture_source,origin,origin_ref_id
      ) VALUES(
        'problem_report',$1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),'submitted',$5,$6,
        CASE WHEN $6::uuid IS NULL THEN NULL ELSE now() END,$7,'api_import','satellite_alert',$8
      )
      RETURNING id
    `,[
      session.sub,description,a.longitude,a.latitude,priority,body.assignedTo||null,dueAt,a.id
    ]);

    const reportId=report.rows[0].id;
    await client.query(
      "INSERT INTO report_status_history(report_id,from_status,to_status,note,actor_id) VALUES($1,NULL,'submitted',$2,$3)",
      [reportId,"Field verification created from vegetation alert "+a.id,session.sub]
    );
    await client.query(`
      UPDATE vegetation_alerts SET
        verification_report_id=$1,
        verification_requested_at=now(),
        verification_requested_by=$2
      WHERE id=$3
    `,[reportId,session.sub,a.id]);
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create_field_verification','vegetation_alert',$2,$3)",
      [session.sub,a.id,JSON.stringify({reportId,priority,dueAt,assignedTo:body.assignedTo||null})]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{reportId,created:true,priority,dueAt}},{status:201});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Could not create field verification task.",400,"FIELD_VERIFICATION_FAILED");
  }finally{
    client.release();
  }
}
