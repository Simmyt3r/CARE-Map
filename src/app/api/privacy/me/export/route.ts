import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!session)return error("Sign in required.",401,"UNAUTHENTICATED");
  if(session.role!=="registered_community")return error("Self-service privacy export is available to community accounts.",403,"FORBIDDEN");

  const user=await query(`
    SELECT id,email,name,role,active,created_at,updated_at,last_login_at
    FROM users
    WHERE id=$1
  `,[session.sub]);

  const reports=await query(`
    SELECT id,type,description,status,priority,submitted_at,updated_at,resolved_at,
      reporter_name,reporter_contact,
      ST_Y(location) latitude,ST_X(location) longitude,
      gps_accuracy_m,captured_at,capture_source,
      related_entity_type,related_entity_id
    FROM reports
    WHERE submitted_by=$1
    ORDER BY submitted_at
  `,[session.sub]);

  const photos=await query(`
    SELECT p.id,p.entity_type,p.entity_id,p.url,p.caption,p.uploaded_at
    FROM photos p
    JOIN reports r ON r.id=p.entity_id AND p.entity_type='report'
    WHERE r.submitted_by=$1
    ORDER BY p.uploaded_at
  `,[session.sub]);

  const notices=await query(`
    SELECT context,notice_version,optional_contact_consent,created_at
    FROM privacy_notice_acceptances
    WHERE user_id=$1
    ORDER BY created_at
  `,[session.sub]);

  return NextResponse.json({
    exportedAt:new Date().toISOString(),
    account:user.rows[0]||null,
    reports:reports.rows,
    reportPhotos:photos.rows,
    privacyNoticeRecords:notices.rows,
    note:"This self-service export covers CARE-Map community-account data and linked reports. Additional records may require a formal privacy request where disclosure could affect another person's rights."
  });
}
