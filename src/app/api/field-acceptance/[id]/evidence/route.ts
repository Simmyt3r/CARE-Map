import {uploadPhotoToCloudinary,PhotoStorageError} from "@/lib/photo-storage";
import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const runtime="nodejs";

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!uuid.test(id))return error("Invalid acceptance run ID.");
  const result=await query(`
    SELECT e.id,e.check_key,e.url,e.caption,e.uploaded_at,u.name uploaded_by_name
    FROM field_acceptance_evidence e
    LEFT JOIN users u ON u.id=e.uploaded_by
    WHERE e.run_id=$1
    ORDER BY e.uploaded_at DESC
  `,[id]);
  return NextResponse.json({data:result.rows});
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!uuid.test(id))return error("Invalid acceptance run ID.");

  const run=await query("SELECT id FROM field_acceptance_runs WHERE id=$1",[id]);
  if(!run.rowCount)return error("Field acceptance run not found.",404);

  const form=await request.formData();
  const file=form.get("file");
  const checkKey=String(form.get("checkKey")||"").trim()||null;
  const caption=String(form.get("caption")||"").trim().slice(0,500);

  if(!(file instanceof File))return error("Evidence image is required.");
  if(!allowedTypes.has(file.type))return error("Only JPEG, PNG and WebP images are allowed.");
  if(file.size>4*1024*1024)return error("Evidence image must be 4 MB or smaller.");

  if(checkKey){
    const check=await query(
      "SELECT 1 FROM field_acceptance_checks WHERE run_id=$1 AND check_key=$2",[id,checkKey]
    );
    if(!check.rowCount)return error("Acceptance check not found.",404);
  }


  try{
    const blob=await uploadPhotoToCloudinary(file,"field-acceptance",id);
    const result=await query<{id:string}>(`
      INSERT INTO field_acceptance_evidence(run_id,check_key,url,caption,uploaded_by)
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
    `,[id,checkKey,blob.url,caption||null,session.sub]);

    await query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'field_acceptance_evidence','field_acceptance',$2,$3)",
      [session.sub,id,JSON.stringify({evidenceId:result.rows[0].id,checkKey,url:blob.url})]
    );

    return NextResponse.json({data:{id:result.rows[0].id,url:blob.url,caption,checkKey}},{status:201});
  }catch(e){
    if(e instanceof PhotoStorageError)return error(e.message,e.status,"PHOTO_STORAGE_ERROR");
    return error("Photo storage or database operation failed. Contact the administrator.","Acceptance evidence upload failed.",500,"UPLOAD_FAILED");
  }
}
