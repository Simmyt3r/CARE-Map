import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
export async function GET(){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const result=await query(`SELECT * FROM(
 SELECT 'borehole' entity_type,id,name,lga_code,risk_score,risk_level FROM boreholes
 UNION ALL SELECT 'asset',id,name,lga_code,risk_score,risk_level FROM assets
 UNION ALL SELECT 'forest_site',id,name,lga_code,risk_score,risk_level FROM forest_sites
 UNION ALL SELECT 'river',id,COALESCE(name,local_name),lga_code,risk_score,risk_level FROM rivers WHERE verified
 )x ORDER BY risk_score DESC,name NULLS LAST LIMIT 100`);
 return NextResponse.json({data:result.rows});
}
