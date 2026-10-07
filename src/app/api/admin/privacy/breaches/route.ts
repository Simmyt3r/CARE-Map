import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {breachHoursRemaining} from "@/lib/privacy";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const result=await query(`
    SELECT b.*,u.name created_by_name,
      CASE
        WHEN b.ndpc_notification_required AND b.ndpc_notified_at IS NULL
        THEN GREATEST(0,72-(EXTRACT(EPOCH FROM (now()-b.detected_at))/3600.0))
        ELSE NULL
      END ndpc_hours_remaining
    FROM privacy_breach_register b
    LEFT JOIN users u ON u.id=b.created_by
    ORDER BY CASE WHEN b.status='open' THEN 0 WHEN b.status='contained' THEN 1 ELSE 2 END,b.detected_at DESC
    LIMIT 250
  `);
  return NextResponse.json({data:result.rows});
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    title?:string;description?:string;detectedAt?:string;likelyRisk?:boolean;highRisk?:boolean;
    affectedCategories?:string;approximateSubjects?:number|null;containmentActions?:string;
  }|null;

  const title=String(body?.title||"").trim().slice(0,220);
  const description=String(body?.description||"").trim().slice(0,6000);
  const detectedAt=String(body?.detectedAt||"").trim();
  const detected=new Date(detectedAt);
  const highRisk=Boolean(body?.highRisk);
  const likelyRisk=Boolean(body?.likelyRisk)||highRisk;

  if(title.length<3)return error("Breach title is required.");
  if(description.length<10)return error("Describe the breach or suspected breach.");
  if(!detectedAt||Number.isNaN(detected.getTime()))return error("Provide a valid detection date/time.");
  if(detected.getTime()>Date.now()+5*60_000)return error("Detection time cannot be in the future.");

  const approximate=body?.approximateSubjects==null?null:Number(body.approximateSubjects);
  if(approximate!=null&&(!Number.isFinite(approximate)||approximate<0))return error("Approximate subjects must be zero or greater.");

  const result=await query<{id:string}>(`
    INSERT INTO privacy_breach_register(
      title,description,detected_at,likely_risk,high_risk,affected_categories,approximate_subjects,
      containment_actions,ndpc_notification_required,subjects_notification_required,created_by,updated_by
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$4,$5,$9,$9)
    RETURNING id
  `,[
    title,description,detected.toISOString(),likelyRisk,highRisk,
    String(body?.affectedCategories||"").trim().slice(0,2000)||null,
    approximate==null?null:Math.round(approximate),
    String(body?.containmentActions||"").trim().slice(0,5000)||null,
    session.sub
  ]);

  const hours=breachHoursRemaining(detected);
  await query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'privacy_breach_create','privacy_breach',$2,$3)",
    [session.sub,result.rows[0].id,JSON.stringify({likelyRisk,highRisk,hoursRemaining:hours})]
  );

  return NextResponse.json({data:{id:result.rows[0].id,ndpcHoursRemaining:likelyRisk?hours:null}},{status:201});
}
