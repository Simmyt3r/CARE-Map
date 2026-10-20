import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession} from "@/lib/auth";
import {query} from "@/lib/db";
import {error} from "@/lib/http";
import {canCrf,crfAccess,crfAudit,crfTransaction} from "@/lib/crf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=z.string().uuid(),ref=z.string().trim().min(3).max(180),short=z.string().trim().min(5).max(2200);
const coordinates=z.object({latitude:z.number().finite().min(-90).max(90),
 longitude:z.number().finite().min(-180).max(180),
 gpsAccuracyM:z.number().min(0).max(100000).nullable().optional()});
const actions=z.discriminatedUnion("action",[
 z.object({action:z.literal("inspection"),cigId:uuid,inspectedOn:z.iso.date(),
  activityVerified:z.boolean(),notes:short,evidenceRef:ref.optional(),
  latitude:z.number().finite().min(-90).max(90).optional(),
  longitude:z.number().finite().min(-180).max(180).optional(),
  gpsAccuracyM:z.number().min(0).max(100000).nullable().optional()})
 .refine(x=>(x.latitude===undefined)===(x.longitude===undefined),{
  message:"Supply both latitude and longitude."}),
 z.object({action:z.literal("asset"),cigId:uuid,assetReference:ref,
  assetDescription:short,amountNgn:z.number().finite().nonnegative().max(1e13).optional(),
  evidenceRef:ref.optional()}),
 z.object({action:z.literal("corrective_action"),communityId:uuid,cigId:uuid.optional(),
  findingType:ref,findingDetail:short,severity:z.enum(["low","medium","high","critical"]),
  dueOn:z.iso.date(),assignedTo:uuid.optional()}),
 z.object({action:z.literal("verify_inspection"),inspectionId:uuid,
  decision:z.enum(["verified","disputed"])}),
 z.object({action:z.literal("close_action"),actionId:uuid,evidenceRef:ref}),
 z.object({action:z.literal("verify_action_closure"),actionId:uuid})
]);
export async function GET(){
 const session=await getSession();
 try{
  const access=await crfAccess(session);
  if(!access||!canCrf(access.roles,"view"))return error("CRF duty required.",403,"CRF_FORBIDDEN");
  const [inspections,assets,actions]=await Promise.all([
   query(`SELECT i.id,i.cig_id,c.cig_name,k.community_name,k.lga_code,i.inspected_on,
      i.activity_verified,i.findings_status,i.notes,i.evidence_ref,
      ST_X(i.location) longitude,ST_Y(i.location) latitude,
      i.gps_accuracy_m,i.created_at
      FROM crf_inspections i JOIN crf_cigs c ON c.id=i.cig_id
      JOIN crf_communities k ON k.id=c.community_id
      ORDER BY i.inspected_on DESC LIMIT 120`),
   query(`SELECT a.id,a.cig_id,c.cig_name,k.community_name,k.lga_code,
      a.asset_reference,a.asset_description,a.verified_status,a.amount_ngn,
      a.last_verified_at,a.evidence_ref
      FROM crf_assets a JOIN crf_cigs c ON c.id=a.cig_id
      JOIN crf_communities k ON k.id=c.community_id
      ORDER BY a.id DESC LIMIT 150`),
   query(`SELECT a.id,a.community_id,k.community_name,k.lga_code,a.finding_type,
      a.finding_detail,a.severity,a.due_on,a.status,a.closure_evidence_ref
      FROM crf_corrective_actions a JOIN crf_communities k ON k.id=a.community_id
      ORDER BY a.due_on ASC LIMIT 160`)
  ]);
  return NextResponse.json({data:{inspections:inspections.rows,assets:assets.rows,actions:actions.rows},
    roles:access.roles},{headers:{"Cache-Control":"no-store"}});
 }catch{return error("CRF field records unavailable. Confirm migration 019.",503,"CRF_NOT_READY");}
}
export async function POST(request:Request){
 const session=await getSession();
 const access=await crfAccess(session);
 if(!access)return error("CRF authorization required.",403,"CRF_FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const raw=await request.text();if(raw.length>13000)return error("Request too large.",413);
 let payload:unknown;try{payload=JSON.parse(raw);}catch{return error("Invalid JSON.");}
 const parsed=actions.safeParse(payload);
 if(!parsed.success)return error(parsed.error.issues[0]?.message||"Invalid field record.");
 const x=parsed.data;
 if(!canCrf(access.roles,["verify_inspection","verify_action_closure"].includes(x.action)?"verify":"field"))
  return error("Your CRF role does not permit this action.",403,"CRF_FORBIDDEN");
 try{
  const result=await crfTransaction(async tx=>{
   let idValue="",kind="crf_inspection";
   if(x.action==="inspection"){
    if(x.latitude!==undefined&&x.longitude!==undefined){
      coordinates.parse({latitude:x.latitude,longitude:x.longitude,gpsAccuracyM:x.gpsAccuracyM});
      const match=await tx.query(`SELECT ST_Covers(l.boundary,
       ST_SetSRID(ST_MakePoint($2,$3),4326)) AS matched FROM crf_cigs c
       JOIN crf_communities k ON k.id=c.community_id JOIN lgas l ON l.code=k.lga_code
       WHERE c.id=$1 AND l.boundary IS NOT NULL`,[x.cigId,x.longitude,x.latitude]);
      if(match.rows[0]?.matched!==true)
       throw new Error("Inspection coordinates must match the CIG community LGA or be corrected.");
    }
    const r=await tx.query<{id:string}>(`INSERT INTO crf_inspections(
      cig_id,inspected_on,location,gps_accuracy_m,activity_verified,notes,evidence_ref,officer_id)
      VALUES($1,$2,CASE WHEN $3::double precision IS NULL THEN NULL
       ELSE ST_SetSRID(ST_MakePoint($4,$3),4326) END,$5,$6,$7,$8,$9) RETURNING id`,
       [x.cigId,x.inspectedOn,x.latitude??null,x.longitude??null,
       x.gpsAccuracyM??null,x.activityVerified,x.notes,x.evidenceRef||null,session!.sub]);
    idValue=r.rows[0].id;
   }else if(x.action==="asset"){
    kind="crf_asset";
    const r=await tx.query<{id:string}>(`INSERT INTO crf_assets(
      cig_id,asset_reference,asset_description,amount_ngn,evidence_ref)
      VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [x.cigId,x.assetReference,x.assetDescription,x.amountNgn??null,x.evidenceRef||null]);
    idValue=r.rows[0].id;
   }else if(x.action==="corrective_action"){
    kind="crf_corrective_action";
    if(x.cigId){
     const check=await tx.query(`SELECT c.id FROM crf_cigs c WHERE c.id=$1 AND c.community_id=$2`,[x.cigId,x.communityId]);
     if(!check.rowCount)throw new Error("Selected CIG is not in the selected community.");
    }
    const r=await tx.query<{id:string}>(`INSERT INTO crf_corrective_actions(
      community_id,cig_id,finding_type,finding_detail,severity,assigned_to,due_on,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [x.communityId,x.cigId||null,x.findingType,x.findingDetail,x.severity,
      x.assignedTo||null,x.dueOn,session!.sub]);
    idValue=r.rows[0].id;
   }else if(x.action==="verify_inspection"){
    const r=await tx.query(`UPDATE crf_inspections SET findings_status=$2,
      reviewed_by=$3,reviewed_at=now() WHERE id=$1 AND findings_status='pending_review'
      AND officer_id<>$3 RETURNING id`,[x.inspectionId,x.decision,session!.sub]);
    if(!r.rowCount)throw new Error("Inspection requires independent review or has already been reviewed.");
    idValue=x.inspectionId;
   }else if(x.action==="close_action"){
    kind="crf_corrective_action";
    const r=await tx.query(`UPDATE crf_corrective_actions
      SET status='resolved',closure_evidence_ref=$2,updated_at=now()
      WHERE id=$1 AND status IN ('open','in_progress') RETURNING id`,[x.actionId,x.evidenceRef]);
    if(!r.rowCount)throw new Error("Finding not open for resolution.");
    idValue=x.actionId;
   }else{
    kind="crf_corrective_action";
    const r=await tx.query(`UPDATE crf_corrective_actions SET
      status='verified_closed',reviewed_by=$2,updated_at=now()
      WHERE id=$1 AND status='resolved' AND created_by<>$2
      AND closure_evidence_ref IS NOT NULL RETURNING id`,[x.actionId,session!.sub]);
    if(!r.rowCount)throw new Error("Only an independent reviewer may verify evidence-backed closure.");
    idValue=x.actionId;
   }
   await crfAudit(tx,session!.sub,x.action,kind,idValue);
   return{id:idValue};
  });
  return NextResponse.json({ok:true,...result},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const msg=e instanceof Error?e.message:"CRF field command not accepted.";
  return error(/duplicate key|foreign key/i.test(msg)?"Duplicate or missing parent record.":msg.slice(0,250),409,"CRF_FIELD_REJECTED");
 }
}
