import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {crfAccess,canCrf} from "@/lib/crf";
import {query} from "@/lib/db";
import {error} from "@/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Internal T14 preparation aid. NOT a filed official community return.
 * Entries can be reconciled only against original bank statements and ledgers.
 */
export async function GET(request:Request){
 const session=await getSession();const access=await crfAccess(session);
 if(!access||!canCrf(access.roles,"report"))
  return error("CRF reporting duty required.",403,"CRF_FORBIDDEN");
 const sp=new URL(request.url).searchParams;
 const communityId=sp.get("communityId")||"";
 const month=sp.get("month")||"";
 if(!/^[0-9a-f-]{36}$/i.test(communityId)||!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))
  return error("A registered community and a valid month are required.");
 const first=month+"-01";
 try{
  const result=await query(`
   WITH community AS (
     SELECT id,community_name,lga_code FROM crf_communities WHERE id=$1::uuid
   ), scoped AS (
     SELECT l.id,c.women_led
     FROM crf_loans l JOIN crf_cigs c ON c.id=l.cig_id
     WHERE c.community_id=$1::uuid AND l.status<>'cancelled'
   ), disbursements AS (
     SELECT s.id,s.women_led,d.amount_ngn,d.transfer_date
     FROM scoped s JOIN crf_disbursements d ON d.loan_id=s.id
     WHERE d.verification='verified'
       AND d.transfer_date<($2::date+INTERVAL '1 month')
   ), recovery AS (
     SELECT s.id,r.paid_at,(r.principal_ngn+r.service_charge_ngn+r.default_fee_ngn) total
     FROM scoped s JOIN crf_repayments r ON r.loan_id=s.id
     WHERE r.verification='verified' AND r.account_destination='account_2'
       AND r.paid_at<($2::date+INTERVAL '1 month')
   ), dues AS (
     SELECT s.id,i.due_date,(i.principal_due_ngn+i.service_charge_due_ngn) total
     FROM scoped s JOIN crf_instalments i ON i.loan_id=s.id
     WHERE i.due_date<($2::date+INTERVAL '1 month')
   )
   SELECT cm.community_name,cm.lga_code,
     (SELECT count(DISTINCT id)::int FROM disbursements WHERE transfer_date>=$2::date) financed_month,
     (SELECT count(DISTINCT id)::int FROM disbursements) financed_cumulative,
     (SELECT count(DISTINCT id)::int FROM disbursements WHERE women_led AND transfer_date>=$2::date) women_month,
     (SELECT count(DISTINCT id)::int FROM disbursements WHERE women_led) women_cumulative,
     (SELECT COALESCE(sum(amount_ngn),0) FROM disbursements WHERE transfer_date>=$2::date) disb_month,
     (SELECT COALESCE(sum(amount_ngn),0) FROM disbursements) disb_cumulative,
     (SELECT COALESCE(sum(amount_ngn),0) FROM disbursements WHERE women_led AND transfer_date>=$2::date) women_disb_month,
     (SELECT COALESCE(sum(amount_ngn),0) FROM disbursements WHERE women_led) women_disb_cumulative,
     (SELECT COALESCE(sum(total),0) FROM dues WHERE due_date>=$2::date) due_month,
     (SELECT COALESCE(sum(total),0) FROM dues) due_cumulative,
     (SELECT COALESCE(sum(total),0) FROM recovery WHERE paid_at>=$2::date) recovered_month,
     (SELECT COALESCE(sum(total),0) FROM recovery) recovered_cumulative,
     (SELECT bank_balance_ngn FROM crf_account_reconciliations
        WHERE community_id=$1::uuid AND account_type='account_1'
          AND period_month=$2::date LIMIT 1) account1_balance,
     (SELECT bank_balance_ngn FROM crf_account_reconciliations
        WHERE community_id=$1::uuid AND account_type='account_2'
          AND period_month=$2::date LIMIT 1) account2_balance,
     (SELECT count(*)::int FROM disbursements) verified_disbursement_entries,
     (SELECT count(*)::int FROM recovery) verified_repayment_entries
   FROM community cm`,[communityId,first]);
  const r=result.rows[0];
  if(!r)return error("The community does not exist in the CRF registry.",404,"CRF_NOT_FOUND");
  const number=(value:unknown)=>Number(value)||0;
  const amt=(m:unknown,c:unknown)=>number(m).toFixed(2)+" / "+number(c).toFixed(2);
  const monthlyDue=number(r.due_month),cumulativeDue=number(r.due_cumulative);
  const rate=(collected:unknown,due:number)=>due?((100*number(collected))/due).toFixed(2)+"%":"N/A";
  const values:Record<string,string>={
   period:month,
   cigs_financed:amt(r.financed_month,r.financed_cumulative),
   disbursed:amt(r.disb_month,r.disb_cumulative),
   women_groups:amt(r.women_month,r.women_cumulative),
   women_disbursed:amt(r.women_disb_month,r.women_disb_cumulative),
   due:amt(r.due_month,r.due_cumulative),
   recovered:amt(r.recovered_month,r.recovered_cumulative),
   recovery_rate:rate(r.recovered_month,monthlyDue)+" / "+rate(r.recovered_cumulative,cumulativeDue),
   ...(r.account1_balance===null?{}:{account1_balance:number(r.account1_balance).toFixed(2)}),
   ...(r.account2_balance===null?{}:{account2_balance:number(r.account2_balance).toFixed(2)})
  };
  return NextResponse.json({data:{
   community:r.community_name,lga:r.lga_code,month,values,
   hasVerifiedEntries:Number(r.verified_disbursement_entries)>0,
   hasAccount1Reconciliation:r.account1_balance!==null,
   hasAccount2Reconciliation:r.account2_balance!==null,
   provenance:"CRF verified disbursement and repayment entries, signed instalment schedule and dated account reconciliations as recorded in CARE-Map.",
   missing:[
     "Account 1 inflows from SPMU are not separately captured by the current private CRF ledger. Enter from the signed bank statement.",
     "Groups in arrears, aged arrears and GRM complaints require source register confirmation; do not infer zero.",
     "Monthly scheduled amounts due and receipts this month are not a reconciled cohort recovery calculation.",
     "Final T14 must be checked and signed by CRFMC Chairperson and CBA, then submitted through authorized channels."
   ]
  }},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return error("Verified T14 preparation data could not be loaded.",503,"CRF_UNAVAILABLE");
 }
}
