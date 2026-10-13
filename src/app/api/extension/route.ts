import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession,isAdmin,isStaff} from "@/lib/auth";
import {query} from "@/lib/db";
import {error} from "@/lib/http";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const uuid=z.string().uuid();
const projectType=z.enum(["borehole","afforestation","erosion_control","watershed_restoration","livelihood","other"]);
const date=z.iso.date();
const projectSchema=z.object({
  action:z.literal("create_project"),
  projectCode:z.string().trim().min(3).max(80).regex(/^[\w-]+$/),
  projectName:z.string().trim().min(3).max(180),
  projectType,
  communityName:z.string().trim().min(2).max(180),
  lgaCode:z.string().min(2).max(60),
  latitude:z.number().finite().min(-90).max(90),
  longitude:z.number().finite().min(-180).max(180),
  gpsAccuracy:z.number().finite().min(0).max(100000).nullable().optional(),
  captureSource:z.enum(["device_gps","manual","survey_import"]),
  capturedAt:z.iso.datetime({offset:true}).nullable().optional(),
  contactName:z.string().trim().min(2).max(160),
  contactPhone:z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/),
  contactRole:z.string().trim().max(100).optional(),
  contactConsent:z.literal(true),
  projectStatus:z.enum(["planned","active","completed","needs_maintenance","closed"]).default("active"),
  description:z.string().trim().max(2000).optional()
});
const visitSchema=z.object({
  action:z.literal("visit"),
  interventionId:uuid,visitDate:date,
  visitType:z.enum(["training","maintenance_support","inspection","community_meeting","follow_up"]),
  guidance:z.string().trim().min(10).max(2500),
  outcome:z.string().trim().max(2000).optional(),
  nextVisitDue:date.nullable().optional()
});
const scoreSchema=z.object({
  action:z.literal("assess"),
  interventionId:uuid,assessedOn:date,
  maintenance:z.number().int().min(0).max(5),
  function:z.number().int().min(0).max(5),
  cleanliness:z.number().int().min(0).max(5),
  participation:z.number().int().min(0).max(5),
  evidenceNotes:z.string().trim().min(20).max(2500)
});
const reviewSchema=z.object({
  action:z.literal("review_assessment"),assessmentId:uuid,
  decision:z.enum(["verified","rejected"]),
  reviewerNotes:z.string().trim().min(10).max(2000)
});
const reviewLocationSchema=z.object({
  action:z.literal("review_location"),interventionId:uuid,
  decision:z.enum(["verified","rejected"]),
  notes:z.string().trim().min(10).max(2000)
});
const rewardSchema=z.object({
  action:z.literal("reward_decision"),interventionId:uuid,
  periodStart:date,periodEnd:date,decision:z.enum(["recommended","approved","declined"]),
  justification:z.string().trim().min(20).max(2000)
});
const commands=z.discriminatedUnion("action",[
  projectSchema,visitSchema,scoreSchema,reviewSchema,reviewLocationSchema,rewardSchema
]);
function originMatches(request:Request){
  const origin=request.headers.get("origin");
  return !!origin&&origin===new URL(request.url).origin;
}

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  try{
    // Contacts are intentionally returned ONLY via the staff-authenticated endpoint.
    const [projects,visits,assessments,leaderboard,rewards]=await Promise.all([
      query(`
        SELECT p.id,p.project_code,p.project_name,p.project_type,p.community_name,p.lga_code,
          ST_Y(p.location) latitude,ST_X(p.location) longitude,p.gps_accuracy_m,
          p.capture_source,p.captured_at,p.location_review,p.location_notes,
          p.contact_name,p.contact_phone,p.contact_role,p.contact_consent,
          p.project_status,p.description,p.created_at
        FROM community_interventions p ORDER BY p.created_at DESC LIMIT 300
      `),
      query(`SELECT v.id,v.intervention_id,p.project_name,p.community_name,v.visit_date,v.visit_type,
          v.guidance,v.outcome,v.next_visit_due,u.name officer_name
        FROM extension_visits v JOIN community_interventions p ON p.id=v.intervention_id
        LEFT JOIN users u ON u.id=v.officer_id ORDER BY v.visit_date DESC LIMIT 60`),
      query(`SELECT a.id,a.intervention_id,p.project_name,p.community_name,p.project_type,
          a.assessed_on,a.maintenance_score,a.function_score,a.cleanliness_score,
          a.participation_score,a.evidence_notes,a.evidence_photo_url,a.verification_status,a.reviewer_notes,
          a.evaluator_id,u.name evaluator_name
        FROM community_maintenance_assessments a
        JOIN community_interventions p ON p.id=a.intervention_id
        JOIN users u ON u.id=a.evaluator_id
        ORDER BY a.assessed_on DESC,a.created_at DESC LIMIT 100`),
      query(`
        WITH scores AS (
          SELECT p.id,p.project_name,p.project_code,p.project_type,p.community_name,p.lga_code,
             p.location_review,p.contact_consent,p.project_status,
             COUNT(a.id)::int reviews,
             ROUND(AVG((a.maintenance_score*0.35 + a.function_score*0.30 +
                        a.cleanliness_score*0.15 + a.participation_score*0.20)*20)::numeric,1) score
          FROM community_interventions p
          LEFT JOIN community_maintenance_assessments a ON a.intervention_id=p.id
            AND a.verification_status='verified' AND a.evidence_photo_url IS NOT NULL
            AND a.assessed_on BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE
          GROUP BY p.id
        ), ranked AS (
          SELECT *, (reviews>=2 AND location_review='verified' AND contact_consent
            AND project_status IN ('active','completed')) eligible
          FROM scores
        ), competition AS (
          SELECT *,
            COUNT(*) FILTER (WHERE eligible) OVER (PARTITION BY project_type) eligible_peers,
            CASE WHEN eligible THEN
              DENSE_RANK() OVER (PARTITION BY project_type ORDER BY
                 CASE WHEN eligible THEN score ELSE NULL END DESC NULLS LAST)
              ELSE NULL END competition_rank
          FROM ranked
        )
        SELECT * FROM competition ORDER BY project_type,eligible DESC,score DESC NULLS LAST
        LIMIT 300
      `),
      query(`SELECT r.id,r.intervention_id,r.period_start,r.period_end,r.project_type,
          r.decision,r.justification,r.decided_at,p.project_name,p.community_name
          FROM community_reward_decisions r JOIN community_interventions p ON p.id=r.intervention_id
          ORDER BY r.decided_at DESC LIMIT 40`)
    ]);
    return NextResponse.json({projects:projects.rows,visits:visits.rows,
      assessments:assessments.rows,leaderboard:leaderboard.rows,rewards:rewards.rows,
      policy:{periodDays:90,minVerifiedAssessments:2,minEligiblePeers:2,
        thresholdMeters:30,weights:{maintenance:35,functionality:30,cleanliness:15,participation:20},
        note:"Scores require independent admin verification. Ranking is decision support, never an automatic extra-project award."}
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return error("Could not load extension records. Apply migration 016 and check Aiven availability.",503,"DATA_UNAVAILABLE");
  }
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  if(!originMatches(request))return error("Invalid request origin.",403,"FORBIDDEN");
  const body=commands.safeParse(await request.json().catch(()=>null));
  if(!body.success)return error("Invalid form: "+body.error.issues.slice(0,3).map(x=>x.path.join(".")+": "+x.message).join("; "),400);
  const input=body.data;
  try{
    if(input.action==="create_project"){
      // All projects need a consenting community contact and a valid Benue LGA.
      // Disagreement with imported LGA polygons is explicitly held for review.
      const lg=await query<{found:boolean;inside:boolean|null}>(`
        SELECT true found,CASE WHEN boundary IS NULL THEN NULL ELSE
          ST_Covers(boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) END inside
        FROM lgas WHERE code=$1
      `,[input.lgaCode,input.longitude,input.latitude]);
      if(!lg.rowCount)return error("Unknown Benue LGA.",400);
      if(lg.rows[0].inside===false)return error("GPS point is outside the selected LGA boundary. Confirm coordinates and LGA before saving.",400);
      const r=await query<{id:string}>(`
        INSERT INTO community_interventions(
          project_code,project_name,project_type,community_name,lga_code,location,
          gps_accuracy_m,capture_source,captured_at,contact_name,contact_phone,contact_role,
          contact_consent,contact_consent_at,project_status,description,created_by,updated_by
        ) VALUES($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),
          $8,$9,$10,$11,$12,$13,TRUE,now(),$14,$15,$16,$16) RETURNING id
      `,[input.projectCode,input.projectName,input.projectType,input.communityName,
        input.lgaCode,input.longitude,input.latitude,input.gpsAccuracy??null,
        input.captureSource,input.capturedAt??null,input.contactName,input.contactPhone,
        input.contactRole||null,input.projectStatus,input.description||null,session.sub]);
      await audit(session.sub,"create","community_intervention",r.rows[0].id,{lga:input.lgaCode,projectType:input.projectType});
      return NextResponse.json({ok:true,id:r.rows[0].id,message:"Project saved. Location awaits independent review."},{status:201});
    }
    if(input.action==="visit"){
      const r=await query<{id:string}>(`INSERT INTO extension_visits(intervention_id,visit_date,visit_type,guidance,outcome,next_visit_due,officer_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[
        input.interventionId,input.visitDate,input.visitType,input.guidance,
        input.outcome||null,input.nextVisitDue||null,session.sub]);
      await audit(session.sub,"extension_visit","community_intervention",input.interventionId,{visitId:r.rows[0].id});
      return NextResponse.json({ok:true,message:"Extension visit recorded."},{status:201});
    }
    if(input.action==="assess"){
      const r=await query<{id:string}>(`INSERT INTO community_maintenance_assessments(
        intervention_id,assessed_on,maintenance_score,function_score,cleanliness_score,
        participation_score,evidence_notes,evaluator_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[
        input.interventionId,input.assessedOn,input.maintenance,input.function,
        input.cleanliness,input.participation,input.evidenceNotes,session.sub]);
      await audit(session.sub,"maintenance_assessment","community_intervention",input.interventionId,{assessmentId:r.rows[0].id});
      return NextResponse.json({ok:true,message:"Evaluation submitted for independent verification."},{status:201});
    }
    if(!isAdmin(session))return error("Administrator approval required.",403,"FORBIDDEN");
    if(input.action==="review_assessment"){
      const r=await query(`UPDATE community_maintenance_assessments
        SET verification_status=$1,reviewer_notes=$2,reviewed_by=$3,reviewed_at=now()
        WHERE id=$4 AND evaluator_id<>$3 AND verification_status='pending'
          AND ($1='rejected' OR evidence_photo_url IS NOT NULL) RETURNING id`,[
        input.decision,input.reviewerNotes,session.sub,input.assessmentId]);
      if(!r.rowCount)return error("Assessment must be pending, photo-backed and independently reviewed.",409);
      await audit(session.sub,"review_assessment","community_maintenance_assessment",input.assessmentId,{decision:input.decision});
      return NextResponse.json({ok:true,message:"Evaluation review saved."});
    }
    if(input.action==="review_location"){
      const r=await query(`
        UPDATE community_interventions p SET
          location_review=$1,location_notes=$2,location_reviewed_by=$3,location_reviewed_at=now()
        FROM lgas l
        WHERE p.id=$4 AND l.code=p.lga_code AND p.location_review='pending'
          AND ($1='rejected' OR (
            p.capture_source IN ('device_gps','survey_import')
            AND p.gps_accuracy_m IS NOT NULL AND p.gps_accuracy_m<=30
            AND p.captured_at IS NOT NULL AND l.boundary IS NOT NULL
            AND ST_Covers(l.boundary,p.location)
          ))
        RETURNING p.id
      `,[input.decision,input.notes,session.sub,input.interventionId]);
      if(!r.rowCount)return error("GPS review requires documented capture, accuracy ≤30 m and a matching LGA polygon. Otherwise reject or recapture.",409);
      await audit(session.sub,"review_location","community_intervention",input.interventionId,{decision:input.decision});
      return NextResponse.json({ok:true,message:"Location review recorded."});
    }
    if(input.action==="reward_decision"){
      if(input.periodEnd<input.periodStart)return error("Reward period dates are reversed.");
      const eligible=await query<{project_type:string;eligible:boolean;peer_count:string;rank:string}>(`
        WITH scores AS (
          SELECT p.id,p.project_type,p.location_review,p.contact_consent,p.project_status,
            COUNT(a.id) reviews,
            AVG((a.maintenance_score*.35+a.function_score*.30+
              a.cleanliness_score*.15+a.participation_score*.20)*20) score
          FROM community_interventions p
          LEFT JOIN community_maintenance_assessments a ON a.intervention_id=p.id
            AND a.verification_status='verified' AND a.evidence_photo_url IS NOT NULL
            AND a.assessed_on BETWEEN $2::date AND $3::date
          GROUP BY p.id
        ), candidates AS (
          SELECT *, (reviews>=2 AND location_review='verified' AND contact_consent
            AND project_status IN ('active','completed')) eligible
          FROM scores
        ), ranked AS (
          SELECT *, DENSE_RANK() OVER (PARTITION BY project_type
            ORDER BY CASE WHEN eligible THEN score ELSE NULL END DESC NULLS LAST) rank,
            COUNT(*) FILTER(WHERE eligible) OVER(PARTITION BY project_type) peer_count
          FROM candidates
        )
        SELECT project_type,eligible,peer_count::text,rank::text FROM ranked WHERE id=$1
      `,[input.interventionId,input.periodStart,input.periodEnd]);
      const info=eligible.rows[0];
      if(!info)return error("Intervention not found.",404);
      if(input.decision!=="declined"&&(!info.eligible||Number(info.peer_count)<2||Number(info.rank)!==1)){
        return error("Recommendations require at least two eligible same-type communities and a top-ranked project with two verified evaluations.",409);
      }
      const r=await query<{id:string}>(`
        INSERT INTO community_reward_decisions(period_start,period_end,project_type,intervention_id,decision,justification,decision_by)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(period_start,period_end,project_type,intervention_id)
        DO UPDATE SET decision=EXCLUDED.decision,justification=EXCLUDED.justification,
          decision_by=EXCLUDED.decision_by,decided_at=now()
        RETURNING id
      `,[input.periodStart,input.periodEnd,info.project_type,input.interventionId,
        input.decision,input.justification,session.sub]);
      await audit(session.sub,"reward_decision","community_intervention",input.interventionId,{decision:input.decision,awardId:r.rows[0].id});
      return NextResponse.json({ok:true,message:"Decision recorded. Additional project award still requires authorized program allocation."});
    }
    return error("Unsupported action.",400);
  }catch(e){
    const code=(e as {code?:string})?.code;
    if(code==="23505")return error("A project code, assessment, or reward decision already exists.",409);
    if(code==="23503")return error("Referenced intervention or account does not exist.",400);
    return error("Operation failed. Check the input and migrations before retrying.",500);
  }
}

async function audit(actor:string,action:string,entityType:string,id:string,metadata:Record<string,unknown>){
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)",[
    actor,action,entityType,id,JSON.stringify(metadata)
  ]);
}
