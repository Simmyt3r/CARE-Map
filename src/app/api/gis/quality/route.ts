import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const [issues,duplicates,rivers,reports]=await Promise.all([
    query("SELECT * FROM gis_point_quality WHERE quality_issue<>'ok' ORDER BY quality_issue,lga_code,name LIMIT 200"),
    query(`
      SELECT a.id a_id,b.id b_id,a.name a_name,b.name b_name,a.lga_code,
             round(ST_Distance(a.location::geography,b.location::geography)::numeric,1) distance_m
      FROM boreholes a JOIN boreholes b ON a.id<b.id
      WHERE ST_DWithin(a.location::geography,b.location::geography,20)
      ORDER BY distance_m LIMIT 50
    `),
    query("SELECT id,COALESCE(name,local_name) name,lga_code,created_at FROM rivers WHERE verified=FALSE ORDER BY created_at ASC LIMIT 100"),
    query("SELECT id,type,description,status,submitted_at FROM reports WHERE status IN ('submitted','under_review') AND submitted_at<now()-INTERVAL '30 days' ORDER BY submitted_at ASC LIMIT 100")
  ]);
  return NextResponse.json({
    data:{
      pointIssues:issues.rows,
      possibleDuplicateBoreholes:duplicates.rows,
      unverifiedRivers:rivers.rows,
      staleReports:reports.rows,
      counts:{
        pointIssues:issues.rowCount||0,
        possibleDuplicates:duplicates.rowCount||0,
        unverifiedRivers:rivers.rowCount||0,
        staleReports:reports.rowCount||0
      }
    }
  });
}
