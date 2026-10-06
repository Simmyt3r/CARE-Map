import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {reportSchema} from "@/lib/validators";
import {query} from "@/lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){
 const ip=clientIp(request);if(!rateLimit("reports:"+ip,8,60*60_000))return error("Too many reports from this connection. Try again later.",429,"RATE_LIMITED");
 const parsed=reportSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return error("Please provide a valid report, description and coordinates",400);
 const session=await getSession();const d=parsed.data;
 const result=await query<{id:string}>("INSERT INTO reports(type,submitted_by,reporter_name,reporter_contact,related_entity_type,related_entity_id,description,location,gps_accuracy_m,captured_at,capture_source) VALUES($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_MakePoint($8,$9),4326),$10,$11,$12) RETURNING id",[d.type,session?.sub||null,d.reporterName||null,d.reporterContact||null,d.relatedEntityType||null,d.relatedEntityId||null,d.description,d.longitude,d.latitude,d.gpsAccuracy??null,d.capturedAt||null,d.captureSource||"manual"]);
 return NextResponse.json({data:{id:result.rows[0].id,status:"submitted"}},{status:201});
}
export async function GET(){
 const session=await getSession();if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
 const result=await query("SELECT r.*,ST_Y(r.location) latitude,ST_X(r.location) longitude,u.name submitter_name FROM reports r LEFT JOIN users u ON u.id=r.submitted_by ORDER BY r.submitted_at DESC LIMIT 500");
 return NextResponse.json({data:result.rows,total:result.rowCount});
}
