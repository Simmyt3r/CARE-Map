import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {assessGroup,canCrf,crfAccess,crfAudit,crfTransaction} from "@/lib/crf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const id=z.string().uuid();
const name=z.string().trim().min(2).max(160);
const reference=z.string().trim().min(3).max(120);
const money=z.number().finite().nonnegative().max(1e13);
const commands=z.discriminatedUnion("action",[
 z.object({action:z.literal("community"),communityCode:reference,
  communityName:name,lgaCode:z.string().trim().min(2).max(50),
  notes:z.string().trim().max(1200).optional(),
  latitude:z.number().min(-90).max(90).optional(),
  longitude:z.number().min(-180).max(180).optional()}).refine(
   x=>(x.latitude===undefined)===(x.longitude===undefined),
   {message:"Provide both latitude and longitude."}),
 z.object({action:z.literal("cig"),communityId:id,cigCode:reference,
  cigName:name,enterpriseType:name,womenLed:z.boolean(),savingsNgn:money}),
 z.object({action:z.literal("member"),cigId:id,memberReference:reference,
  sex:z.enum(["female","male","other","undisclosed"]),youthUnder35:z.boolean().nullable().optional(),
  participationVerified:z.boolean().default(false)}),
 z.object({action:z.literal("qualify"),cigId:id,qualificationRef:reference}),
 z.object({action:z.literal("verify_member"),memberId:id,verificationRef:reference}),
 z.object({action:z.literal("verify_community"),communityId:id,approvalReference:reference,
   bankMandateRef:reference,account1EvidenceRef:reference,account2EvidenceRef:reference,
   spmuEndorsementRef:reference})
]);
export async function GET(request:Request){
 const user=await getSession();
 try{
  const access=await crfAccess(user);
  if(!access||!canCrf(access.roles,"view"))return error("CRF role required.",403,"CRF_FORBIDDEN");
  const lga=new URL(request.url).searchParams.get("lga")||"";
  if(lga.length>60)return error("Invalid LGA filter.");
  const [communities,cigs,lgas,members]=await Promise.all([
   query(`SELECT id,community_code,community_name,lga_code,cycle,status,
         ST_Y(location) latitude,ST_X(location) longitude,crfmc_formed,
         (account1_evidence_ref IS NOT NULL AND account2_evidence_ref IS NOT NULL
          AND bank_mandate_ref IS NOT NULL) AS bank_controls_documented,created_at
         FROM crf_communities WHERE ($1='' OR lga_code=$1)
         ORDER BY created_at DESC LIMIT 300`,[lga]),
   query(`SELECT c.id,c.community_id,c.cig_code,c.cig_name,c.enterprise_type,
       c.women_led,c.savings_ngn,c.qualification,c.verified_at,c.created_at,
       k.lga_code,k.community_name,COUNT(m.id)::int AS member_count,
       COUNT(m.id) FILTER (WHERE m.sex='female')::int AS female_count,
       COUNT(m.id) FILTER (WHERE m.participation_verified)::int AS verified_count
       FROM crf_cigs c JOIN crf_communities k ON k.id=c.community_id
       LEFT JOIN crf_cig_members m ON m.cig_id=c.id
       WHERE ($1='' OR k.lga_code=$1)
       GROUP BY c.id,k.id
       ORDER BY c.created_at DESC LIMIT 400`,[lga]),
   query("SELECT code,name FROM lgas ORDER BY name"),
   query(`SELECT m.id,m.cig_id,m.member_reference,m.sex,m.participation_verified,m.recorded_by,
      m.verification_ref FROM crf_cig_members m JOIN crf_cigs c ON c.id=m.cig_id
      JOIN crf_communities k ON k.id=c.community_id
      WHERE ($1='' OR k.lga_code=$1) ORDER BY m.created_at DESC LIMIT 750`,[lga])
  ]);
  return NextResponse.json({data:{communities:communities.rows,cigs:cigs.rows,
    lgas:lgas.rows,members:members.rows},
    roles:access.roles},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return error("CRF registry is unavailable. Confirm database migration 019 and Aiven connectivity.",503,"CRF_NOT_READY");
 }
}
export async function POST(request:Request){
 const actor=await getSession();
 const access=await crfAccess(actor);
 if(!access||!canCrf(access.roles,"registry"))return error("CRF registry permission required.",403,"CRF_FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const raw=await request.text();
 if(raw.length>12_000)return error("CRF registry request too large.",413);
 let input:unknown;try{input=JSON.parse(raw);}catch{return error("Invalid JSON.");}
 const parsed=commands.safeParse(input);
 if(!parsed.success)return error(parsed.error.issues[0]?.message||"Invalid registry data.");
 const x=parsed.data;
 try{
  const result=await crfTransaction(async tx=>{
   let entity="crf_community",idValue="";
   const event=x.action;
   if(x.action==="community"){
    let locationAllowed=true;
    if(x.latitude!==undefined&&x.longitude!==undefined){
     const test=await tx.query(`SELECT ST_Covers(boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) ok
       FROM lgas WHERE code=$1 AND boundary IS NOT NULL`,[x.lgaCode,x.longitude,x.latitude]);
     locationAllowed=test.rows[0]?.ok===true;
    }
    if(!locationAllowed)throw new Error("The point must be inside the selected mapped LGA; verify coordinates.");
    const r=await tx.query<{id:string}>(`INSERT INTO crf_communities(
       community_code,community_name,lga_code,notes,location,created_by)
       VALUES($1,$2,$3,$4,
         CASE WHEN $5::double precision IS NULL THEN NULL
         ELSE ST_SetSRID(ST_MakePoint($6,$5),4326) END,$7) RETURNING id`,
       [x.communityCode,x.communityName,x.lgaCode,x.notes||null,x.latitude??null,x.longitude??null,actor!.sub]);
    idValue=r.rows[0].id;
   }else if(x.action==="cig"){
    entity="crf_cig";
    const r=await tx.query<{id:string}>(`INSERT INTO crf_cigs(
      community_id,cig_code,cig_name,enterprise_type,women_led,savings_ngn,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [x.communityId,x.cigCode,x.cigName,x.enterpriseType,x.womenLed,x.savingsNgn,actor!.sub]);
    idValue=r.rows[0].id;
   }else if(x.action==="member"){
    entity="crf_cig_member";
    const locked=await tx.query("SELECT id FROM crf_cigs WHERE id=$1 AND qualification IN ('draft','review') FOR UPDATE",[x.cigId]);
    if(!locked.rowCount)throw new Error("CIG is unavailable or already qualified.");
    const count=await tx.query<{count:string}>(`SELECT COUNT(*)::text count FROM crf_cig_members WHERE cig_id=$1`,[x.cigId]);
    if(Number(count.rows[0].count)>=15)throw new Error("Each CIG is limited to 15 registered members.");
    const r=await tx.query<{id:string}>(`INSERT INTO crf_cig_members(
      cig_id,member_reference,sex,youth_under_35,participation_verified,recorded_by)
      VALUES($1,$2,$3,$4,FALSE,$5) RETURNING id`,
      [x.cigId,x.memberReference,x.sex,x.youthUnder35??null,actor!.sub]);
    idValue=r.rows[0].id;
   }else if(x.action==="verify_member"){
    entity="crf_cig_member";
    const row=await tx.query<{recorded_by:string}>(`SELECT recorded_by FROM crf_cig_members
      WHERE id=$1 AND participation_verified=FALSE FOR UPDATE`,[x.memberId]);
    if(!row.rowCount)throw new Error("Member record is missing or already verified.");
    if(row.rows[0].recorded_by===actor!.sub)
      throw new Error("The registrar cannot independently verify their own member entry.");
    await tx.query(`UPDATE crf_cig_members SET participation_verified=TRUE,
      verified_by=$2,verification_ref=$3 WHERE id=$1`,[x.memberId,actor!.sub,x.verificationRef]);
    idValue=x.memberId;
   }else if(x.action==="qualify"){
    entity="crf_cig";
    const cig=await tx.query<{created_by:string}>(`SELECT created_by FROM crf_cigs
       WHERE id=$1 AND qualification IN ('draft','review') FOR UPDATE`,[x.cigId]);
    if(!cig.rowCount)throw new Error("Group unavailable or already reviewed.");
    if(cig.rows[0].created_by===actor!.sub)
      throw new Error("A different authorized officer must review this CIG.");
    const members=await tx.query<{sex:string;participation_verified:boolean}>(`SELECT sex,participation_verified
      FROM crf_cig_members WHERE cig_id=$1 FOR UPDATE`,[x.cigId]);
    const status=assessGroup(members.rows);
    if(!status.ready)throw new Error("A CIG requires exactly 15 verified members, at least six female.");
    await tx.query(`UPDATE crf_cigs SET qualification='qualified',qualification_ref=$2,
       verified_by=$3,verified_at=now() WHERE id=$1`,[x.cigId,x.qualificationRef,actor!.sub]);
    idValue=x.cigId;
   }else{
    entity="crf_community";
    const r=await tx.query<{created_by:string}>(`SELECT created_by FROM crf_communities
       WHERE id=$1 AND status='draft' FOR UPDATE`,[x.communityId]);
    if(!r.rowCount)throw new Error("Community is not awaiting eligibility review.");
    if(r.rows[0].created_by===actor!.sub)
      throw new Error("A different authorized officer must verify this community.");
    await tx.query(`UPDATE crf_communities SET status='eligible',approval_reference=$2,
       bank_mandate_ref=$3,account1_evidence_ref=$4,account2_evidence_ref=$5,
       spmu_endorsement_ref=$6,verified_by=$7,verified_at=now(),updated_at=now()
       WHERE id=$1`,[x.communityId,x.approvalReference,x.bankMandateRef,
       x.account1EvidenceRef,x.account2EvidenceRef,x.spmuEndorsementRef,actor!.sub]);
    idValue=x.communityId;
   }
   await crfAudit(tx,actor!.sub,event,entity,idValue);
   return {id:idValue,event};
  });
  return NextResponse.json({ok:true,...result},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const message=e instanceof Error?e.message:"CRF registry operation failed.";
  return error(/duplicate key|unique constraint|violates foreign key/i.test(message)?
   "Duplicate reference or missing parent record.":message.slice(0,250),409,"CRF_RECORD_REJECTED");
 }
}
