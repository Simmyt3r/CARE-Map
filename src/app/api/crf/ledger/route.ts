import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession} from "@/lib/auth";
import {query} from "@/lib/db";
import {canCrf,crfAccess,crfAudit,crfTransaction,flatServiceCharge,trancheAmount,roundNairaCents} from "@/lib/crf";
import {error} from "@/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=z.string().uuid(),ref=z.string().trim().min(3).max(160);
const money=z.number().finite().min(0).max(1e13);
const positive=money.refine(v=>v>0);
const date=z.iso.date();
const actions=z.discriminatedUnion("action",[
 z.object({action:z.literal("register_loan"),cigId:uuid,loanReference:ref,
  cycle:z.number().int().min(1).max(50),principalNgn:positive,approvedCeilingNgn:positive,
  cbnRateReference:ref,tenorMonths:z.union([z.literal(3),z.literal(6),z.literal(12)]),
  approvalMemoRef:ref,approvalDate:date,agreementRef:ref}),
 z.object({action:z.literal("schedule"),loanId:uuid,
  instalments:z.array(z.object({dueDate:date,principalDueNgn:money,
    serviceChargeDueNgn:money})).min(1).max(24)}),
 z.object({action:z.literal("record_disbursement"),loanId:uuid,
  tranche:z.union([z.literal(1),z.literal(2)]),amountNgn:positive,
  transferDate:date,bankReference:ref,t15EndorsementRef:ref,evidenceRef:ref,
  loanAppReference:ref,firstTrancheUseRef:ref.optional()}),
 z.object({action:z.literal("record_repayment"),loanId:uuid,paidAt:date,
  principalNgn:money,serviceChargeNgn:money,defaultFeeNgn:money,
  bankReference:ref,bankEvidenceRef:ref}),
 z.object({action:z.literal("verify_disbursement"),entryId:uuid,decision:z.enum(["verified","rejected"])}),
 z.object({action:z.literal("verify_repayment"),entryId:uuid,decision:z.enum(["verified","rejected"])})
]);

export async function GET(request:Request){
 const user=await getSession();
 try{
  const access=await crfAccess(user);
  if(!access||!canCrf(access.roles,"finance")&&!canCrf(access.roles,"report"))
   return error("Authorized CRF finance/review role required.",403,"CRF_FORBIDDEN");
  const loanId=new URL(request.url).searchParams.get("loanId");
  const loans=await query(`SELECT l.id,l.cig_id,l.loan_reference,l.cycle,l.principal_ngn,
    l.approved_ceiling_ngn,l.tenor_months,l.service_charge_ngn,
    l.approval_date,l.status,l.loan_app_recorded_at,c.cig_name,c.women_led,
    k.community_name,k.lga_code,
    COALESCE((SELECT SUM(d.amount_ngn) FROM crf_disbursements d
      WHERE d.loan_id=l.id AND d.verification='verified'),0) AS disbursed_ngn,
    COALESCE((SELECT SUM(r.principal_ngn) FROM crf_repayments r
      WHERE r.loan_id=l.id AND r.verification='verified'),0) AS principal_repaid_ngn,
    COALESCE((SELECT SUM(i.principal_due_ngn+i.service_charge_due_ngn) FROM crf_instalments i
      WHERE i.loan_id=l.id AND i.due_date<=CURRENT_DATE),0) AS due_to_date_ngn
    FROM crf_loans l JOIN crf_cigs c ON c.id=l.cig_id
    JOIN crf_communities k ON k.id=c.community_id
    ORDER BY l.created_at DESC LIMIT 250`);
  if(!loanId)return NextResponse.json({data:{loans:loans.rows}},{headers:{"Cache-Control":"no-store"}});
  if(!uuid.safeParse(loanId).success)return error("Invalid loan reference.");
  const [schedule,disbursements,repayments]=await Promise.all([
   query("SELECT instalment_no,due_date,principal_due_ngn,service_charge_due_ngn FROM crf_instalments WHERE loan_id=$1 ORDER BY due_date",[loanId]),
   query(`SELECT id,tranche,amount_ngn,transfer_date,bank_reference,verification,created_at,
    verified_at FROM crf_disbursements WHERE loan_id=$1 ORDER BY tranche`,[loanId]),
   query(`SELECT id,paid_at,principal_ngn,service_charge_ngn,default_fee_ngn,
    verification,bank_reference,verified_at FROM crf_repayments WHERE loan_id=$1
    ORDER BY paid_at DESC LIMIT 150`,[loanId])
  ]);
  return NextResponse.json({data:{loans:loans.rows,schedule:schedule.rows,
    disbursements:disbursements.rows,repayments:repayments.rows}},{headers:{"Cache-Control":"no-store"}});
 }catch{return error("CRF ledger unavailable. Confirm migration 019 and database connectivity.",503,"CRF_NOT_READY");}
}
export async function POST(request:Request){
 const user=await getSession();
 const access=await crfAccess(user);
 if(!access)return error("CRF finance access required.",403,"CRF_FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const raw=await request.text();
 if(raw.length>20_000)return error("CRF financial command too large.",413);
 let payload:unknown;try{payload=JSON.parse(raw);}catch{return error("Invalid JSON.");}
 const parsed=actions.safeParse(payload);
 if(!parsed.success)return error(parsed.error.issues[0]?.message||"Invalid finance command.");
 const x=parsed.data;
 const verifier=x.action.startsWith("verify_");
 if(!canCrf(access.roles,verifier?"verify":"finance"))
  return error("Your CRF duty does not permit this action.",403,"CRF_FORBIDDEN");
 try{
  const result=await crfTransaction(async tx=>{
   let idValue="",entity="crf_loan";
   if(x.action==="register_loan"){
    const row=await tx.query<{
      qualification:string;community_status:string;member_count:string;female_count:string;
      verified_count:string;prior_cycle_obligation_ngn:string
    }>(`SELECT c.qualification,k.status AS community_status,
       (SELECT COUNT(*)::text FROM crf_cig_members m WHERE m.cig_id=c.id) member_count,
       (SELECT COUNT(*)::text FROM crf_cig_members m WHERE m.cig_id=c.id AND m.sex='female') female_count,
       (SELECT COUNT(*)::text FROM crf_cig_members m WHERE m.cig_id=c.id AND m.participation_verified) verified_count,
       c.prior_cycle_obligation_ngn FROM crf_cigs c
       JOIN crf_communities k ON k.id=c.community_id WHERE c.id=$1 FOR UPDATE OF c`,[x.cigId]);
    const c=row.rows[0];
    if(!c||c.qualification!=="qualified"||c.community_status!=="eligible"||
      Number(c.member_count)!==15||Number(c.verified_count)!==15||Number(c.female_count)<6)
      throw new Error("Community/CIG eligibility, 15-member evidence or female membership has not been verified.");
    // For existing parent-phase debt, an independent compliance determination
    // is required; this first release refuses to assume that it is current.
    if(Number(c.prior_cycle_obligation_ngn)>0)
      throw new Error("Prior CRF obligation requires verified repayment-arrangement compliance before registration.");
    if(x.principalNgn>x.approvedCeilingNgn)
      throw new Error("Principal exceeds the FPMU-published naira ceiling recorded for the SPMU approval date.");
    const res=await tx.query<{id:string}>(`INSERT INTO crf_loans(
      cig_id,loan_reference,cycle,principal_ngn,approved_ceiling_ngn,cbn_rate_reference,
      tenor_months,approval_memo_ref,approval_date,agreement_ref,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [x.cigId,x.loanReference,x.cycle,x.principalNgn,x.approvedCeilingNgn,
       x.cbnRateReference,x.tenorMonths,x.approvalMemoRef,x.approvalDate,x.agreementRef,user!.sub]);
    idValue=res.rows[0].id;
   }else if(x.action==="schedule"){
    const loan=await tx.query<{principal_ngn:string;service_charge_ngn:string;approval_date:string;tenor_months:number}>(`
      SELECT principal_ngn,service_charge_ngn,approval_date,tenor_months FROM crf_loans WHERE id=$1 FOR UPDATE`,[x.loanId]);
    if(!loan.rowCount)throw new Error("Loan not found.");
    const existing=await tx.query("SELECT id FROM crf_disbursements WHERE loan_id=$1 LIMIT 1",[x.loanId]);
    if(existing.rowCount)throw new Error("Schedule cannot be edited after a disbursement is recorded.");
    if(x.instalments.some((v,i)=>i>0&&v.dueDate<=x.instalments[i-1].dueDate))
      throw new Error("Instalment dates must be strictly increasing.");
    const principal=roundNairaCents(x.instalments.reduce((sum,i)=>sum+i.principalDueNgn,0));
    const charge=roundNairaCents(x.instalments.reduce((sum,i)=>sum+i.serviceChargeDueNgn,0));
    if(Math.abs(principal-Number(loan.rows[0].principal_ngn))>0.001||
       Math.abs(charge-Number(loan.rows[0].service_charge_ngn))>0.001)
      throw new Error("Scheduled principal and service charge must exactly match the signed loan obligations.");
    if(x.instalments.slice(0,-1).some(i=>i.serviceChargeDueNgn!==0))
      throw new Error("The flat service charge is payable with the final instalment only.");
    await tx.query("DELETE FROM crf_instalments WHERE loan_id=$1",[x.loanId]);
    for(let i=0;i<x.instalments.length;i++){
      const row=x.instalments[i];
      await tx.query(`INSERT INTO crf_instalments(
        loan_id,instalment_no,due_date,principal_due_ngn,service_charge_due_ngn)
        VALUES($1,$2,$3,$4,$5)`,[x.loanId,i+1,row.dueDate,row.principalDueNgn,row.serviceChargeDueNgn]);
    }
    idValue=x.loanId;
   }else if(x.action==="record_disbursement"){
    entity="crf_disbursement";
    const loan=await tx.query<{principal_ngn:string;approval_date:string;
      agreement_ref:string;status:string;community_id:string;loan_app_recorded_at:string|null}>(`
      SELECT l.principal_ngn,l.approval_date,l.agreement_ref,l.status,c.community_id,
       l.loan_app_recorded_at FROM crf_loans l JOIN crf_cigs c ON c.id=l.cig_id
       WHERE l.id=$1 FOR UPDATE OF l`,[x.loanId]);
    if(!loan.rowCount||loan.rows[0].status==="cancelled")throw new Error("Loan unavailable.");
    const expected=trancheAmount(Number(loan.rows[0].principal_ngn),x.tranche);
    if(Math.abs(expected-x.amountNgn)>0.001)throw new Error("Tranche amount must match the 70/30 signed loan schedule.");
    const bank=await tx.query(`SELECT id FROM crf_communities WHERE id=$1 AND status='eligible'
      AND account1_evidence_ref IS NOT NULL AND account2_evidence_ref IS NOT NULL
      AND bank_mandate_ref IS NOT NULL AND spmu_endorsement_ref IS NOT NULL`,[loan.rows[0].community_id]);
    if(!bank.rowCount)throw new Error("CRFMC's two-account/T15 mandate evidence has not been accepted.");
    const schedule=await tx.query<{principal:string;charge:string}>(`SELECT COALESCE(SUM(principal_due_ngn),0)::text principal,
      COALESCE(SUM(service_charge_due_ngn),0)::text charge FROM crf_instalments WHERE loan_id=$1`,[x.loanId]);
    if(Math.abs(Number(schedule.rows[0].principal)-Number(loan.rows[0].principal_ngn))>0.001)
      throw new Error("Full signed repayment schedule is required before recording disbursement.");
    if(x.tranche===2){
      const first=await tx.query(`SELECT id FROM crf_disbursements WHERE loan_id=$1
        AND tranche=1 AND verification='verified'`,[x.loanId]);
      if(!first.rowCount||!x.firstTrancheUseRef)
        throw new Error("Second tranche requires independently verified first tranche and use-of-funds evidence.");
    }
    const r=await tx.query<{id:string}>(`INSERT INTO crf_disbursements(
      loan_id,tranche,amount_ngn,transfer_date,bank_reference,t15_endorsement_ref,evidence_ref,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[
       x.loanId,x.tranche,x.amountNgn,x.transferDate,x.bankReference,
       x.t15EndorsementRef,x.evidenceRef,user!.sub
      ]);
    await tx.query(`UPDATE crf_loans SET loan_app_reference=$2,
      loan_app_recorded_at=COALESCE(loan_app_recorded_at,now()),
      first_tranche_use_ref=COALESCE($3,first_tranche_use_ref)
      WHERE id=$1`,[x.loanId,x.loanAppReference,x.firstTrancheUseRef||null]);
    idValue=r.rows[0].id;
   }else if(x.action==="record_repayment"){
    entity="crf_repayment";
    if(x.principalNgn+x.serviceChargeNgn+x.defaultFeeNgn<=0)throw new Error("Repayment must be positive.");
    const entry=await tx.query<{id:string}>(`INSERT INTO crf_repayments(
      loan_id,paid_at,principal_ngn,service_charge_ngn,default_fee_ngn,
      bank_reference,bank_evidence_ref,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [x.loanId,x.paidAt,x.principalNgn,x.serviceChargeNgn,x.defaultFeeNgn,
       x.bankReference,x.bankEvidenceRef,user!.sub]);
    idValue=entry.rows[0].id;
   }else if(x.action==="verify_disbursement"){
    entity="crf_disbursement";
    const row=await tx.query<{loan_id:string;recorded_by:string;tranche:number}>(`
      SELECT loan_id,recorded_by,tranche FROM crf_disbursements
      WHERE id=$1 AND verification='pending' FOR UPDATE`,[x.entryId]);
    if(!row.rowCount)throw new Error("Pending transfer entry not found.");
    if(row.rows[0].recorded_by===user!.sub)throw new Error("The recorder cannot verify their own bank evidence.");
    await tx.query(`UPDATE crf_disbursements SET verification=$2,
      verified_by=$3,verified_at=now() WHERE id=$1`,[x.entryId,x.decision,user!.sub]);
    idValue=x.entryId;
   }else{
    entity="crf_repayment";
    const row=await tx.query<{loan_id:string;recorded_by:string;principal_ngn:string}>(`
      SELECT loan_id,recorded_by,principal_ngn FROM crf_repayments
      WHERE id=$1 AND verification='pending' FOR UPDATE`,[x.entryId]);
    if(!row.rowCount)throw new Error("Pending repayment entry not found.");
    if(row.rows[0].recorded_by===user!.sub)throw new Error("The recorder cannot verify their own receipt.");
    if(x.decision==="verified"){
      const sums=await tx.query<{disbursed:string;repaid:string}>(`SELECT
       COALESCE((SELECT SUM(amount_ngn) FROM crf_disbursements
         WHERE loan_id=$1 AND verification='verified'),0)::text disbursed,
       COALESCE((SELECT SUM(principal_ngn) FROM crf_repayments
         WHERE loan_id=$1 AND verification='verified'),0)::text repaid`,[row.rows[0].loan_id]);
      if(Number(sums.rows[0].repaid)+Number(row.rows[0].principal_ngn)>Number(sums.rows[0].disbursed)+0.001)
       throw new Error("Verified principal repayments cannot exceed verified loan disbursements.");
    }
    await tx.query(`UPDATE crf_repayments SET verification=$2,verified_by=$3,verified_at=now()
      WHERE id=$1`,[x.entryId,x.decision,user!.sub]);
    idValue=x.entryId;
   }
   await crfAudit(tx,user!.sub,x.action,entity,idValue,
     "decision" in x?{decision:x.decision}:{source:"documented_external_record"});
   return {id:idValue};
  });
  return NextResponse.json({ok:true,...result},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const msg=e instanceof Error?e.message:"CRF ledger operation failed.";
  return error(/duplicate key|unique constraint|violates foreign key/i.test(msg)?
    "This bank or loan reference already exists, or the parent record is missing.":msg.slice(0,260),409,"CRF_LEDGER_REJECTED");
 }
}
