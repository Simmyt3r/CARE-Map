import {uploadPhotoToCloudinary,PhotoStorageError} from "@/lib/photo-storage";
import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const entityMap:Record<string,string>={boreholes:"borehole",assets:"asset","forest-sites":"forest_site",rivers:"river"};
const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);

export const runtime="nodejs";

export async function GET(_:Request,context:{params:Promise<{kind:string;id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{kind,id}=await context.params;
  const entityType=entityMap[kind];
  if(!entityType)return error("Unsupported resource type",400);
  const result=await query(
    "SELECT p.id,p.url,p.caption,p.uploaded_at,u.name uploaded_by_name FROM photos p LEFT JOIN users u ON u.id=p.uploaded_by WHERE p.entity_type=$1 AND p.entity_id=$2 ORDER BY p.uploaded_at DESC",
    [entityType,id]
  );
  return NextResponse.json({data:result.rows});
}

export async function POST(request:Request,context:{params:Promise<{kind:string;id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{kind,id}=await context.params;
  const entityType=entityMap[kind];
  if(!entityType)return error("Unsupported resource type",400);

  const form=await request.formData();
  const file=form.get("file");
  const caption=String(form.get("caption")||"").trim().slice(0,500);
  if(!(file instanceof File))return error("Image file is required.");
  if(!allowedTypes.has(file.type))return error("Only JPEG, PNG and WebP images are allowed.");
  if(file.size>4*1024*1024)return error("Image must be 4 MB or smaller.");


  try{
    const blob=await uploadPhotoToCloudinary(file,entityType,id);
    const result=await query<{id:string}>(
      "INSERT INTO photos(entity_type,entity_id,url,caption,uploaded_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [entityType,id,blob.url,caption||null,session.sub]
    );
    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'photo_upload',$2,$3,$4)",[
      session.sub,entityType,id,JSON.stringify({photoId:result.rows[0].id,url:blob.url})
    ]);
    return NextResponse.json({data:{id:result.rows[0].id,url:blob.url,caption}},{status:201});
  }catch(e){
    if(e instanceof PhotoStorageError)return error(e.message,e.status,"PHOTO_STORAGE_ERROR");
    return error("Photo storage or database operation failed. Contact the administrator.",500,"UPLOAD_FAILED");
  }
}
