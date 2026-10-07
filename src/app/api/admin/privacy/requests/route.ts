import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const result=await query(`
    SELECT r.id,r.reference_code,r.request_type,r.requester_name,r.requester_email,r.requester_phone,
      r.description,r.status,r.submitted_at,r.due_at,r.completed_at,r.assigned_to,
      r.verification_notes,r.resolution_notes,u.name assigned_name,
      (r.due_at<now() AND r.status NOT IN('completed','rejected')) overdue
    FROM data_subject_requests r
    LEFT JOIN users u ON u.id=r.assigned_to
    ORDER BY
      CASE WHEN r.due_at<now() AND r.status NOT IN('completed','rejected') THEN 0 ELSE 1 END,
      r.due_at,
      r.submitted_at DESC
    LIMIT 500
  `);
  return NextResponse.json({data:result.rows});
}
