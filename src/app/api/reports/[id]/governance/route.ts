import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const priorities=new Set(["low","medium","high","critical"]);

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const [report,history,staff]=await Promise.all([
    query(`SELECT r.id,r.status,r.priority,r.assigned_to,r.assigned_at,r.due_at,r.updated_at,
                  r.origin,r.origin_ref_id,r.resolution_notes,
                  u.name assigned_name,u.email assigned_email,
                  va.id satellite_alert_id,va.severity satellite_alert_severity,
                  va.title satellite_alert_title,va.message satellite_alert_message,
                  vm.name satellite_monitor_name
           FROM reports r
           LEFT JOIN users u ON u.id=r.assigned_to
           LEFT JOIN vegetation_alerts va ON va.verification_report_id=r.id
           LEFT JOIN vegetation_monitors vm ON vm.id=va.monitor_id
           WHERE r.id=$1`,[id]),
    query(`SELECT h.id,h.from_status,h.to_status,h.note,h.created_at,u.name actor_name
           FROM report_status_history h LEFT JOIN users u ON u.id=h.actor_id
           WHERE h.report_id=$1 ORDER BY h.created_at DESC LIMIT 100`,[id]),
    query("SELECT id,name,email,role,active FROM users WHERE role IN ('staff','admin') AND deleted_at IS NULL ORDER BY active DESC,name")
  ]);
  if(!report.rowCount)return error("Report not found",404);
  return NextResponse.json({data:{report:report.rows[0],history:history.rows,staff:staff.rows}});
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {priority?:string;assignedTo?:string|null;dueAt?:string|null}|null;
  if(!body)return error("Invalid request body.");
  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};

  if(body.priority!==undefined){
    if(!priorities.has(body.priority))return error("Invalid priority.");
    params.push(body.priority);sets.push("priority=$"+params.length);metadata.priority=body.priority;
  }
  if(body.assignedTo!==undefined){
    if(body.assignedTo){
      const staff=await query("SELECT id FROM users WHERE id=$1 AND role IN ('staff','admin') AND active=TRUE AND deleted_at IS NULL",[body.assignedTo]);
      if(!staff.rowCount)return error("Assigned user must be an active staff member.",400);
    }
    params.push(body.assignedTo||null);sets.push("assigned_to=$"+params.length);
    sets.push("assigned_at="+(body.assignedTo?"now()":"NULL"));
    metadata.assignedTo=body.assignedTo||null;
  }
  if(body.dueAt!==undefined){
    if(body.dueAt&&Number.isNaN(Date.parse(body.dueAt)))return error("Invalid due date.");
    params.push(body.dueAt||null);sets.push("due_at=$"+params.length);metadata.dueAt=body.dueAt||null;
  }
  if(!sets.length)return error("Nothing to update.");
  params.push(id);
  const result=await query("UPDATE reports SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,priority,assigned_to,due_at,assigned_at",[...params]);
  if(!result.rowCount)return error("Report not found",404);
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'governance_update','report',$2,$3)",[
    session.sub,id,JSON.stringify(metadata)
  ]);
  return NextResponse.json({data:result.rows[0]});
}
