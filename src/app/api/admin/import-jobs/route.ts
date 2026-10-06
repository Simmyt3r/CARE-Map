import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
  const result=await query(`SELECT i.*,u.name created_by_name,u.email created_by_email
    FROM import_jobs i LEFT JOIN users u ON u.id=i.created_by
    ORDER BY i.created_at DESC LIMIT 200`);
  return NextResponse.json({data:result.rows,total:result.rowCount});
}
