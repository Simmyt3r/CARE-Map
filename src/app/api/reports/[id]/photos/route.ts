import {uploadPhotoToCloudinary,PhotoStorageError} from "@/lib/photo-storage";
import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);
export const runtime="nodejs";

export async function GET(_:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const result=await query(
    "SELECT p.id,p.url,p.caption,p.uploaded_at,u.name uploaded_by_name FROM photos p LEFT JOIN users u ON u.id=p.uploaded_by WHERE p.entity_type='report' AND p.entity_id=$1 ORDER BY p.uploaded_at DESC",
    [id]
  );
  return NextResponse.json({data:result.rows});
}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const exists=await query("SELECT id FROM reports WHERE id=$1",[id]);
  if(!exists.rowCount)return error("Report not found",404);

  const form=await request.formData();
  const file=form.get("file");
  const caption=String(form.get("caption")||"").trim().slice(0,500);
  if(!(file instanceof File))return error("Image file is required.");
  if(!allowedTypes.has(file.type))return error("Only JPEG, PNG and WebP images are allowed.");
  if(file.size>4*1024*1024)return error("Image must be 4 MB or smaller.");


  try{
    const blob=await uploadPhotoToCloudinary(file,"report",id);
    const result=await query<{id:string}>(
      "INSERT INTO photos(entity_type,entity_id,url,caption,uploaded_by) VALUES('report',$1,$2,$3,$4) RETURNING id",
      [id,blob.url,caption||null,session.sub]
    );
    await query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'photo_upload','report',$2,$3)",
      [session.sub,id,JSON.stringify({photoId:result.rows[0].id,url:blob.url})]
    );
    return NextResponse.json({data:{id:result.rows[0].id,url:blob.url,caption}},{status:201});
  }catch(e){
    if(e instanceof PhotoStorageError)return error(e.message,e.status,"PHOTO_STORAGE_ERROR");
    return error("Photo storage or database operation failed. Contact the administrator.",500,"UPLOAD_FAILED");
  }
}
