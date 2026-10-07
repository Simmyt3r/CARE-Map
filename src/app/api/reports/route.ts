import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {reportSchema} from "@/lib/validators";
import {pool,query} from "@/lib/db";
import {PRIVACY_NOTICE_VERSION} from "@/lib/privacy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  const ip=clientIp(request);
  if(!rateLimit("reports:"+ip,8,60*60_000))return error("Too many reports from this connection. Try again later.",429,"RATE_LIMITED");

  const parsed=reportSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return error("Please provide a valid report, description and coordinates",400);

  const session=await getSession();
  const d=parsed.data;
  const optionalIdentity=Boolean(d.reporterName||d.reporterContact);
  if(optionalIdentity&&!d.optionalContactConsent){
    return error("Consent is required when you choose to provide optional name or contact information.",400,"CONTACT_CONSENT_REQUIRED");
  }

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const result=await client.query<{id:string}>(
      "INSERT INTO reports(type,submitted_by,reporter_name,reporter_contact,related_entity_type,related_entity_id,description,location,gps_accuracy_m,captured_at,capture_source) VALUES($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),$10,$11,$12) RETURNING id",
      [d.type,session?.sub||null,d.reporterName||null,d.reporterContact||null,d.relatedEntityType||null,d.relatedEntityId||null,d.description,d.longitude,d.latitude,d.gpsAccuracy??null,d.capturedAt||null,d.captureSource||"manual"]
    );
    const reportId=result.rows[0].id;
    await client.query(
      "INSERT INTO report_status_history(report_id,from_status,to_status,note,actor_id) VALUES($1,NULL,'submitted','Report submitted',$2)",
      [reportId,session?.sub||null]
    );
    await client.query(
      "INSERT INTO privacy_notice_acceptances(user_id,report_id,context,notice_version) VALUES($1,$2,'report_submission',$3)",
      [session?.sub||null,reportId,PRIVACY_NOTICE_VERSION]
    );
    if(optionalIdentity){
      await client.query(
        "INSERT INTO privacy_notice_acceptances(user_id,report_id,context,notice_version,optional_contact_consent) VALUES($1,$2,'optional_contact',$3,TRUE)",
        [session?.sub||null,reportId,PRIVACY_NOTICE_VERSION]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({data:{id:reportId,status:"submitted"}},{status:201});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Report could not be submitted.",400);
  }finally{
    client.release();
  }
}

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const result=await query(
    `SELECT r.*,ST_Y(r.location) latitude,ST_X(r.location) longitude,
            u.name submitter_name,a.name assigned_name,a.email assigned_email,
            va.id satellite_alert_id,va.severity satellite_alert_severity
     FROM reports r
     LEFT JOIN users u ON u.id=r.submitted_by
     LEFT JOIN users a ON a.id=r.assigned_to
     LEFT JOIN vegetation_alerts va ON va.verification_report_id=r.id
     ORDER BY CASE r.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
              r.submitted_at DESC
     LIMIT 500`
  );
  const staff=await query("SELECT id,name,email,role,active FROM users WHERE role IN ('staff','admin') AND deleted_at IS NULL ORDER BY active DESC,name");
  return NextResponse.json({data:result.rows,total:result.rowCount,staff:staff.rows});
}
