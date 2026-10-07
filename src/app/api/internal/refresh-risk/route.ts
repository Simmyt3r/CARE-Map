import {NextResponse} from "next/server";
import {query} from "@/lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
function authorized(request:Request){const secret=process.env.CRON_SECRET;return!!secret&&request.headers.get("authorization")==="Bearer "+secret;}
export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:"unauthorized"},{status:401});
 await query(`
 UPDATE boreholes SET
 risk_score=LEAST(100,CASE status WHEN 'non_functional' THEN 85 WHEN 'needs_maintenance' THEN 65 WHEN 'decommissioned' THEN 15 ELSE 10 END+
 CASE WHEN last_maintenance_date IS NULL THEN 20 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '365 days' THEN 25 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '180 days' THEN 15 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '90 days' THEN 5 ELSE 0 END);
 UPDATE boreholes SET risk_level=CASE WHEN risk_score>=80 THEN 'critical' WHEN risk_score>=60 THEN 'high' WHEN risk_score>=35 THEN 'medium' ELSE 'low' END;
 UPDATE assets SET
 risk_score=LEAST(100,CASE status WHEN 'non_functional' THEN 85 WHEN 'needs_maintenance' THEN 65 WHEN 'decommissioned' THEN 15 ELSE 10 END+
 CASE WHEN last_maintenance_date IS NULL THEN 20 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '365 days' THEN 25 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '180 days' THEN 15 WHEN last_maintenance_date<CURRENT_DATE-INTERVAL '90 days' THEN 5 ELSE 0 END);
 UPDATE assets SET risk_level=CASE WHEN risk_score>=80 THEN 'critical' WHEN risk_score>=60 THEN 'high' WHEN risk_score>=35 THEN 'medium' ELSE 'low' END;
 UPDATE forest_sites f SET risk_score=LEAST(100,10+15*(SELECT count(*) FROM reports r WHERE r.status IN('submitted','under_review','verified') AND ST_DWithin(r.location::geography,ST_PointOnSurface(f.boundary)::geography,2000)));
 UPDATE forest_sites SET risk_level=CASE WHEN risk_score>=80 THEN 'critical' WHEN risk_score>=60 THEN 'high' WHEN risk_score>=35 THEN 'medium' ELSE 'low' END;
 UPDATE rivers SET risk_score=CASE stress_indicator WHEN 'high' THEN 80 WHEN 'medium' THEN 60 WHEN 'low' THEN 35 ELSE 10 END;
 UPDATE rivers SET risk_level=CASE WHEN risk_score>=80 THEN 'critical' WHEN risk_score>=60 THEN 'high' WHEN risk_score>=35 THEN 'medium' ELSE 'low' END;
 UPDATE reports SET reporter_name=NULL,reporter_contact=NULL,submitted_by=NULL,anonymized_at=now()
 WHERE resolved_at IS NOT NULL AND resolved_at<now()-INTERVAL '2 years' AND anonymized_at IS NULL;

 UPDATE privacy_notice_acceptances p SET user_id=NULL
 WHERE p.report_id IN (
   SELECT r.id FROM reports r
   WHERE r.anonymized_at IS NOT NULL AND r.resolved_at<now()-INTERVAL '2 years'
 ) AND p.user_id IS NOT NULL;
 `);
 return NextResponse.json({ok:true,refreshedAt:new Date().toISOString()});
}
