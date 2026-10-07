import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const includeAcknowledged=new URL(request.url).searchParams.get("all")==="1";
  const result=await query(`
    SELECT a.id,a.monitor_id,a.observation_id,a.severity,a.title,a.message,
      a.vegetation_change_ha,a.vegetation_change_pct,a.acknowledged_at,a.created_at,
      m.name monitor_name,o.observed_for,o.clear_fraction,
      u.name acknowledged_by_name
    FROM vegetation_alerts a
    JOIN vegetation_monitors m ON m.id=a.monitor_id
    JOIN vegetation_monitor_observations o ON o.id=a.observation_id
    LEFT JOIN users u ON u.id=a.acknowledged_by
    ${includeAcknowledged?"":"WHERE a.acknowledged_at IS NULL"}
    ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,a.created_at DESC
    LIMIT 250
  `);
  return NextResponse.json({data:result.rows,total:result.rowCount});
}
