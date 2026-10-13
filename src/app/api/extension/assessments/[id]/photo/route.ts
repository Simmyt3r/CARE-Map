import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {query} from "@/lib/db";
import {error} from "@/lib/http";
import {uploadPhotoToCloudinary,PhotoStorageError} from "@/lib/photo-storage";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  if(request.headers.get("origin")!==new URL(request.url).origin)return error("Invalid request origin.",403,"FORBIDDEN");
  const {id}=await context.params;
  if(!idPattern.test(id))return error("Invalid assessment identifier.");
  const result=await query<{id:string;evaluator_id:string;verification_status:string}>(
    "SELECT id,evaluator_id,verification_status FROM community_maintenance_assessments WHERE id=$1",[id]);
  const row=result.rows[0];
  if(!row)return error("Assessment not found.",404);
  if(session.role!=="admin"&&row.evaluator_id!==session.sub)return error("Only the evaluator or an administrator may add evidence.",403,"FORBIDDEN");
  if(row.verification_status!=="pending")return error("Assessment is no longer awaiting review.",409);
  const form=await request.formData().catch(()=>null);
  const file=form?.get("file");
  if(!(file instanceof File))return error("Choose a JPEG, PNG or WebP evidence image.",400);
  try{
    const photo=await uploadPhotoToCloudinary(file,"maintenance",id);
    await query("UPDATE community_maintenance_assessments SET evidence_photo_url=$1 WHERE id=$2 AND verification_status='pending'",[photo.url,id]);
    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'maintenance_photo','community_maintenance_assessment',$2,$3)",[
      session.sub,id,JSON.stringify({photoUrl:photo.url})
    ]);
    return NextResponse.json({ok:true,url:photo.url,message:"Field photo added. A separate administrator can now review this assessment."});
  }catch(e){
    if(e instanceof PhotoStorageError)return error(e.message,e.status,"PHOTO_UPLOAD_FAILED");
    return error("Could not save maintenance evidence.",500);
  }
}
