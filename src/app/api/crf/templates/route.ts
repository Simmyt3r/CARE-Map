import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession} from "@/lib/auth";
import {query} from "@/lib/db";
import {error} from "@/lib/http";
import {canCrf,crfAccess,crfAudit,crfTransaction,type CrfRole} from "@/lib/crf";
import {CRF_TEMPLATES,getCrfTemplate,safeCrfFormValues,missingCrfFields,validateCrfScoring,type CrfTemplate} from "@/lib/crf-templates";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uid=z.string().uuid(),ref=z.string().trim().min(3).max(350),note=z.string().trim().max(1000);
const scopeId=uid.nullish();
const create=z.object({
 action:z.literal("create"),templateCode:z.string().min(2).max(5),
 communityId:scopeId,cigId:scopeId,loanId:scopeId,
 periodMonth:z.iso.date().nullish(),
 values:z.record(z.string(),z.string()).default({}),
 signedOriginalRef:ref.nullish(),supportEvidenceRef:ref.nullish()
});
const update=z.object({
 action:z.literal("update"),recordId:uid,
 values:z.record(z.string(),z.string()),
 signedOriginalRef:ref.nullish(),supportEvidenceRef:ref.nullish()
});
const submit=z.object({action:z.literal("submit"),recordId:uid});
const review=z.object({action:z.literal("review"),recordId:uid,
 decision:z.enum(["verified","returned"]),reviewNote:note});
const command=z.discriminatedUnion("action",[create,update,submit,review]);
function mayRead(t:CrfTemplate,roles:CrfRole[]){
 if(t.scope==="finance")return canCrf(roles,"finance")||canCrf(roles,"verify")||roles.includes("management");
 if(t.scope==="registry")return canCrf(roles,"registry")||canCrf(roles,"report");
 if(t.scope==="field")return canCrf(roles,"field")||canCrf(roles,"verify")||roles.includes("management");
 return canCrf(roles,"report");
}
function mayWrite(t:CrfTemplate,roles:CrfRole[]){
 if(t.scope==="finance")return canCrf(roles,"finance");
 if(t.scope==="registry")return canCrf(roles,"registry");
 if(t.scope==="field")return canCrf(roles,"field");
 return canCrf(roles,"report");
}
function mayReview(t:CrfTemplate,roles:CrfRole[]){
 if(t.scope==="finance")return canCrf(roles,"verify");
 if(t.scope==="registry")return roles.includes("management")||roles.includes("internal_auditor");
 if(t.scope==="field")return canCrf(roles,"verify")||roles.includes("management");
 return roles.includes("management")||roles.includes("internal_auditor");
}
export async function GET(request:Request){
 const user=await getSession();const access=await crfAccess(user);
 if(!access)return error("Assigned CRF duty required.",403,"CRF_FORBIDDEN");
 const params=new URL(request.url).searchParams;
 const requested=params.get("template")||"";
 if(requested&&!getCrfTemplate(requested))return error("Unknown CRF template.");
 const allowed=CRF_TEMPLATES.filter(t=>mayRead(t,access.roles));
 const templates=allowed.map(t=>({code:t.code,title:t.title,manualPage:t.manualPage,
   scope:t.scope,fields:t.fields,note:t.note||null}));
 if(requested&&!allowed.some(t=>t.code===requested))
  return error("Your duty role cannot open this template.",403,"CRF_FORBIDDEN");
 const id=params.get("id")||"";
 if(id&&!uid.safeParse(id).success)return error("Invalid form ID.");
 try{
  const records=await query(`
   SELECT r.id,r.template_code,r.source_edition,r.community_id,r.cig_id,r.loan_id,
     r.period_month,r.field_values,r.signed_original_ref,r.support_evidence_ref,
     r.status,r.prepared_by,r.reviewed_by,r.reviewed_at,r.review_note,
     r.revision,r.created_at,r.updated_at,
     cm.community_name,c.cig_name,l.loan_reference
   FROM crf_template_records r
   LEFT JOIN crf_communities cm ON cm.id=r.community_id
   LEFT JOIN crf_cigs c ON c.id=r.cig_id
   LEFT JOIN crf_loans l ON l.id=r.loan_id
   WHERE ($1='' OR r.template_code=$1)
     AND ($2='' OR r.id::text=$2)
     AND r.template_code=ANY($3::text[])
   ORDER BY r.created_at DESC LIMIT 150`,[requested,id,allowed.map(t=>t.code)]);
  return NextResponse.json({data:{templates,records:records.rows},roles:access.roles},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return error("CRF template register unavailable. Verify migration 020.",503,"SCHEMA_PENDING");}
}
export async function POST(request:Request){
 const user=await getSession();const access=await crfAccess(user);
 if(!access)return error("Assigned CRF duty required.",403,"CRF_FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const raw=await request.text();
 if(raw.length>75_000)return error("Template request is too large.",413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return error("Invalid JSON.");}
 const parsed=command.safeParse(body);
 if(!parsed.success)return error(parsed.error.issues[0]?.message||"Invalid template request.");
 const cmd=parsed.data;
 try{
  const result=await crfTransaction(async tx=>{
   if(cmd.action==="create"){
    const template=getCrfTemplate(cmd.templateCode);
    if(!template||!mayWrite(template,access.roles))throw Error("This CRF duty cannot create that template.");
    const fields=safeCrfFormValues(template,cmd.values);
    const cm=cmd.communityId||null,cig=cmd.cigId||null,loan=cmd.loanId||null;
    if(!cm&&!cig&&!loan)throw Error("Link this form to an existing community, CIG or loan.");
    if(cmd.periodMonth&&!/^\d{4}-\d{2}-01$/.test(cmd.periodMonth))
     throw Error("The reporting month must be the first day of the month.");
    const check=await tx.query(`
     SELECT
       ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM crf_communities WHERE id=$1)) cm,
       ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM crf_cigs c
          WHERE c.id=$2 AND ($1::uuid IS NULL OR c.community_id=$1))) cig,
       ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM crf_loans l
          JOIN crf_cigs c ON c.id=l.cig_id
          WHERE l.id=$3 AND ($2::uuid IS NULL OR l.cig_id=$2)
            AND ($1::uuid IS NULL OR c.community_id=$1))) loan`,
      [cm,cig,loan]);
    if(!check.rows[0]?.cm||!check.rows[0]?.cig||!check.rows[0]?.loan)
     throw Error("Template links do not belong to the same registered CRF community/CIG/loan.");
    const row=await tx.query<{id:string}>(`
      INSERT INTO crf_template_records(template_code,community_id,cig_id,loan_id,period_month,
        field_values,signed_original_ref,support_evidence_ref,prepared_by)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING id`,
      [template.code,cm,cig,loan,cmd.periodMonth||null,JSON.stringify(fields),
       cmd.signedOriginalRef||null,cmd.supportEvidenceRef||null,user!.sub]);
    await crfAudit(tx,user!.sub,"draft_template","crf_template_record",row.rows[0].id,{template:template.code});
    return {id:row.rows[0].id,status:"draft"};
   }
   const found=await tx.query<{
    id:string;template_code:string;status:string;prepared_by:string;field_values:Record<string,string>;
    signed_original_ref:string|null
   }>("SELECT id,template_code,status,prepared_by,field_values,signed_original_ref FROM crf_template_records WHERE id=$1 FOR UPDATE",[cmd.recordId]);
   const existing=found.rows[0];
   if(!existing)throw Error("CRF template record not found.");
   const template=getCrfTemplate(existing.template_code);
   if(!template)throw Error("Unrecognized CRF template version.");
   if(cmd.action==="update"){
    if(!mayWrite(template,access.roles)||existing.prepared_by!==user!.sub||existing.status!=="draft")
     throw Error("Only the preparer may edit an unsubmitted draft.");
    const fields=safeCrfFormValues(template,cmd.values);
    await tx.query(`UPDATE crf_template_records SET field_values=$2::jsonb,
        signed_original_ref=$3,support_evidence_ref=$4,revision=revision+1,updated_at=now()
      WHERE id=$1`,[cmd.recordId,JSON.stringify(fields),cmd.signedOriginalRef||null,cmd.supportEvidenceRef||null]);
    await crfAudit(tx,user!.sub,"edit_draft","crf_template_record",cmd.recordId,{template:template.code});
    return {id:cmd.recordId,status:"draft"};
   }
   if(cmd.action==="submit"){
    if(!mayWrite(template,access.roles)||existing.prepared_by!==user!.sub||existing.status!=="draft")
     throw Error("Only the preparer may submit their draft.");
    if(!existing.signed_original_ref)throw Error("Attach the controlled-storage reference for the completed, signed original form.");
    const missing=missingCrfFields(template,existing.field_values);
    if(missing.length)throw Error("Complete mandatory source form fields: "+missing.slice(0,3).join("; "));
    validateCrfScoring(template,existing.field_values);
    await tx.query("UPDATE crf_template_records SET status='submitted',updated_at=now() WHERE id=$1",[cmd.recordId]);
    await crfAudit(tx,user!.sub,"submit_template","crf_template_record",cmd.recordId,{template:template.code});
    return {id:cmd.recordId,status:"submitted"};
   }
   if(!mayReview(template,access.roles)||existing.prepared_by===user!.sub||existing.status!=="submitted")
    throw Error("An independent authorized reviewer must assess a submitted template.");
   if(cmd.decision==="verified"&&!existing.signed_original_ref)
    throw Error("Signed original evidence is mandatory for verification.");
   await tx.query(`UPDATE crf_template_records SET status=$2,reviewed_by=$3,
     reviewed_at=now(),review_note=$4,updated_at=now() WHERE id=$1`,
     [cmd.recordId,cmd.decision,user!.sub,cmd.reviewNote]);
   await crfAudit(tx,user!.sub,"review_template","crf_template_record",cmd.recordId,
    {template:template.code,decision:cmd.decision});
   return {id:cmd.recordId,status:cmd.decision};
  });
  return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const msg=e instanceof Error?e.message:"Could not record CRF template.";
  return error(msg.slice(0,350),409,"CRF_TEMPLATE_REJECTED");
 }
}
