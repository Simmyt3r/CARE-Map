import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const result=await query(`SELECT
 (SELECT count(*) FROM boreholes) boreholes,(SELECT count(*) FROM boreholes WHERE status='functional') functional_boreholes,
 (SELECT count(*) FROM assets) assets,(SELECT count(*) FROM forest_sites) forest_sites,(SELECT count(*) FROM rivers WHERE verified) rivers,
 (SELECT count(*) FROM reports WHERE status IN ('submitted','under_review','verified')) open_reports,
 (SELECT count(*) FROM boreholes WHERE risk_level IN ('high','critical'))+(SELECT count(*) FROM assets WHERE risk_level IN ('high','critical'))+
 (SELECT count(*) FROM forest_sites WHERE risk_level IN ('high','critical'))+(SELECT count(*) FROM rivers WHERE risk_level IN ('high','critical')) high_risk_items`);
 const row=result.rows[0],total=Number(row.boreholes||0);return NextResponse.json({data:{...row,functional_rate:total?Math.round(Number(row.functional_boreholes)*100/total):0}});
}
