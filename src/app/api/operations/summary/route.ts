import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const [summary,queue,imports,vegetationAlerts]=await Promise.all([
    query(`SELECT
      count(*) FILTER(WHERE status NOT IN ('resolved','rejected'))::int open_reports,
      count(*) FILTER(WHERE status NOT IN ('resolved','rejected') AND assigned_to IS NULL)::int unassigned,
      count(*) FILTER(WHERE status NOT IN ('resolved','rejected') AND due_at IS NOT NULL AND due_at<now())::int overdue,
      count(*) FILTER(WHERE status NOT IN ('resolved','rejected') AND priority='critical')::int critical,
      count(*) FILTER(WHERE status='submitted' AND submitted_at<now()-INTERVAL '7 days')::int waiting_over_7_days
      FROM reports`),
    query(`SELECT r.id,r.type,r.description,r.status,r.priority,r.submitted_at,r.due_at,r.assigned_to,r.origin,
                  u.name assigned_name,ST_Y(r.location) latitude,ST_X(r.location) longitude
           FROM reports r LEFT JOIN users u ON u.id=r.assigned_to
           WHERE r.status NOT IN ('resolved','rejected')
           ORDER BY
             CASE r.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
             CASE WHEN r.due_at IS NOT NULL AND r.due_at<now() THEN 0 ELSE 1 END,
             r.submitted_at ASC
           LIMIT 100`),
    query(`SELECT i.id,i.kind,i.format,i.total_rows,i.imported_rows,i.failed_rows,i.created_at,u.name created_by_name
           FROM import_jobs i LEFT JOIN users u ON u.id=i.created_by
           ORDER BY i.created_at DESC LIMIT 12`),
    query(`SELECT a.id,a.monitor_id,a.severity,a.title,a.message,a.vegetation_change_ha,a.vegetation_change_pct,
                  a.created_at,m.name monitor_name,o.observed_for,o.clear_fraction,
                  a.verification_report_id,a.verification_requested_at,
                  vr.status verification_status,vr.priority verification_priority,vr.due_at verification_due_at,
                  vu.name verification_assigned_name,count(*) OVER()::int total_open
           FROM vegetation_alerts a
           JOIN vegetation_monitors m ON m.id=a.monitor_id
           JOIN vegetation_monitor_observations o ON o.id=a.observation_id
           LEFT JOIN reports vr ON vr.id=a.verification_report_id
           LEFT JOIN users vu ON vu.id=vr.assigned_to
           WHERE a.acknowledged_at IS NULL
           ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,a.created_at DESC
           LIMIT 20`)
  ]);
  return NextResponse.json({data:{
    summary:{...summary.rows[0],open_vegetation_alerts:Number(vegetationAlerts.rows[0]?.total_open||0)},
    queue:queue.rows,imports:imports.rows,vegetationAlerts:vegetationAlerts.rows
  }});
}
