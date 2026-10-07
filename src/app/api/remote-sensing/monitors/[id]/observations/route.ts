import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const result=await query(`
    SELECT o.id,o.observed_for,o.scene,o.mean_ndvi,o.clear_fraction,o.vegetation_ha,
      o.change_ha,o.change_pct,o.severity,o.status,o.error_message,o.created_at,
      a.id alert_id,a.severity alert_severity,a.title alert_title,a.message alert_message,
      a.acknowledged_at,au.name acknowledged_by_name
    FROM vegetation_monitor_observations o
    LEFT JOIN vegetation_alerts a ON a.observation_id=o.id
    LEFT JOIN users au ON au.id=a.acknowledged_by
    WHERE o.monitor_id=$1
    ORDER BY o.created_at DESC LIMIT 100
  `,[id]);
  return NextResponse.json({data:result.rows});
}
