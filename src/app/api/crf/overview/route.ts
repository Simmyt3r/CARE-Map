import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {query} from "@/lib/db";
import {crfAccess,canCrf,crfIndicators,CRF_POLICY} from "@/lib/crf";
import {error} from "@/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 const user=await getSession();
 try{
  const access=await crfAccess(user);
  if(!access||!canCrf(access.roles,"report"))return error("CRF reporting role required.",403,"CRF_FORBIDDEN");
  const params=new URL(request.url).searchParams;
  const month=params.get("month")||new Date().toISOString().slice(0,7);
  const lga=params.get("lga")||"";
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)||lga.length>60)
   return error("Invalid report period or LGA.");
  const first=month+"-01";
  const sql=`
    WITH scope_loans AS (
      SELECT l.id,l.principal_ngn,c.women_led,k.id community_id,k.lga_code
      FROM crf_loans l JOIN crf_cigs c ON c.id=l.cig_id
      JOIN crf_communities k ON k.id=c.community_id
      WHERE ($1='' OR k.lga_code=$1) AND l.status<>'cancelled'
    ), loan_balances AS (
      SELECT s.id,s.women_led,s.lga_code,
        COALESCE((SELECT SUM(d.amount_ngn) FROM crf_disbursements d
          WHERE d.loan_id=s.id AND d.verification='verified'
            AND d.transfer_date<($2::date+INTERVAL '1 month')),0) disb,
        COALESCE((SELECT SUM(r.principal_ngn) FROM crf_repayments r
          WHERE r.loan_id=s.id AND r.verification='verified'
            AND r.paid_at<($2::date+INTERVAL '1 month')),0) principal_repaid,
        COALESCE((SELECT SUM(r.principal_ngn+r.service_charge_ngn) FROM crf_repayments r
          WHERE r.loan_id=s.id AND r.verification='verified'
            AND r.paid_at<($2::date+INTERVAL '1 month')),0) paid_total,
        COALESCE((SELECT SUM(i.principal_due_ngn+i.service_charge_due_ngn)
          FROM crf_instalments i WHERE i.loan_id=s.id
            AND i.due_date<=LEAST(CURRENT_DATE,($2::date+INTERVAL '1 month - 1 day')::date)-60),0) aged_due
      FROM scope_loans s
    ), sums AS (
      SELECT
        COALESCE(SUM(GREATEST(0,disb-principal_repaid)),0) total_outstanding,
        COALESCE(SUM(GREATEST(0,disb-principal_repaid))
          FILTER (WHERE aged_due>paid_total AND disb>principal_repaid),0) at_risk_outstanding
      FROM loan_balances
    ), monetary AS (
      SELECT
        COALESCE((SELECT SUM(i.principal_due_ngn+i.service_charge_due_ngn)
          FROM crf_instalments i JOIN scope_loans s ON s.id=i.loan_id
          WHERE i.due_date >= $2::date AND i.due_date<($2::date+INTERVAL '1 month')
          AND EXISTS(SELECT 1 FROM crf_disbursements d
            WHERE d.loan_id=s.id AND d.verification='verified')),0) due_in_period,
        COALESCE((SELECT SUM(r.principal_ngn+r.service_charge_ngn)
          FROM crf_repayments r JOIN scope_loans s ON s.id=r.loan_id
          WHERE r.verification='verified'
          AND r.paid_at>=$2::date AND r.paid_at<($2::date+INTERVAL '1 month')),0) recovered_in_period,
        COALESCE((SELECT SUM(d.amount_ngn) FROM crf_disbursements d
          JOIN scope_loans s ON s.id=d.loan_id
          WHERE d.verification='verified'
            AND d.transfer_date<($2::date+INTERVAL '1 month')),0) disbursed,
        COALESCE((SELECT SUM(d.amount_ngn) FROM crf_disbursements d
          JOIN scope_loans s ON s.id=d.loan_id
          WHERE d.verification='verified' AND s.women_led
            AND d.transfer_date<($2::date+INTERVAL '1 month')),0) women_disbursed
    )
    SELECT s.total_outstanding,s.at_risk_outstanding,m.*
    FROM sums s CROSS JOIN monetary m`;
  const [financial,counts,lgas]=await Promise.all([
   query(sql,[lga,first]),
   query(`SELECT
     (SELECT COUNT(*)::int FROM crf_communities WHERE ($1='' OR lga_code=$1)) communities,
     (SELECT COUNT(*)::int FROM crf_cigs c JOIN crf_communities k ON k.id=c.community_id
       WHERE ($1='' OR k.lga_code=$1)) cigs,
     (SELECT COUNT(*)::int FROM crf_cig_members m JOIN crf_cigs c ON c.id=m.cig_id
       JOIN crf_communities k ON k.id=c.community_id WHERE ($1='' OR k.lga_code=$1)) beneficiaries,
     (SELECT COUNT(*)::int FROM crf_loans l JOIN crf_cigs c ON c.id=l.cig_id
       JOIN crf_communities k ON k.id=c.community_id WHERE ($1='' OR k.lga_code=$1)) loans,
     (SELECT COUNT(*)::int FROM crf_disbursements d JOIN crf_loans l ON l.id=d.loan_id
       JOIN crf_cigs c ON c.id=l.cig_id JOIN crf_communities k ON k.id=c.community_id
       WHERE ($1='' OR k.lga_code=$1) AND d.verification='pending') pending_disbursements,
     (SELECT COUNT(*)::int FROM crf_repayments r JOIN crf_loans l ON l.id=r.loan_id
       JOIN crf_cigs c ON c.id=l.cig_id JOIN crf_communities k ON k.id=c.community_id
       WHERE ($1='' OR k.lga_code=$1) AND r.verification='pending') pending_repayments,
     (SELECT COUNT(*)::int FROM crf_assets a JOIN crf_cigs c ON c.id=a.cig_id
       JOIN crf_communities k ON k.id=c.community_id
       WHERE ($1='' OR k.lga_code=$1) AND a.verified_status='unverified') assets_to_verify,
     (SELECT COUNT(*)::int FROM crf_corrective_actions a JOIN crf_communities k ON k.id=a.community_id
       WHERE ($1='' OR k.lga_code=$1) AND a.status NOT IN ('resolved','verified_closed')) open_actions`,[lga]),
   query("SELECT code,name FROM lgas ORDER BY name")
  ]);
  const f=financial.rows[0];
  const indicators=crfIndicators({
   dueInPeriod:Number(f.due_in_period),
   recoveredInPeriod:Number(f.recovered_in_period),
   outstandingTotal:Number(f.total_outstanding),
   outstandingAtRisk60:Number(f.at_risk_outstanding),
   verifiedDisbursedTotal:Number(f.disbursed),
   womenLedDisbursed:Number(f.women_disbursed)
  });
  return NextResponse.json({
    scope:{state:"Benue",lga,month,source:"CRF verified entries in this Benue CARE-Map deployment"},
    counts:counts.rows[0],indicators,
    benchmarks:CRF_POLICY,lgas:lgas.rows,
    alerts:{
      recoveryLow:indicators.recoveryPercent!==null&&indicators.recoveryPercent<CRF_POLICY.recoveryMinimum,
      par60High:indicators.par60Percent!==null&&indicators.par60Percent>CRF_POLICY.par60Maximum,
      womenFundLow:indicators.womenFundPercent!==null&&indicators.womenFundPercent<CRF_POLICY.womenValueMinimum
    },
    reportingDeadlines:{communityReturnDay:7,stateReturnDay:12,correctiveActionDay:12},
    limitations:[
      "Missing or unverified bank entries do not count toward financial figures.",
      "PAR60 uses verified principal repayments and earliest-due allocation; validate with original schedules and reconciliations.",
      "Zero due amounts yield N/A, not zero recovery performance.",
      "This system does not authorize or execute transfers."
    ]
  },{headers:{"Cache-Control":"no-store"}});
 }catch{
  return error("CRF indicators cannot be loaded. Check migration 019 and database connectivity.",503,"CRF_NOT_READY");
 }
}
