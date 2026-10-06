import {NextResponse} from "next/server";
import {getPublicResource,isPublicKind,isPublicResourceId} from "@/lib/public-resource";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_:Request,context:{params:Promise<{kind:string;id:string}>}){
  const{kind,id}=await context.params;
  if(!isPublicKind(kind)||!isPublicResourceId(id))return NextResponse.json({error:{code:"NOT_FOUND",message:"Resource not found"}},{status:404});
  const resource=await getPublicResource(kind,id);
  if(!resource)return NextResponse.json({error:{code:"NOT_FOUND",message:"Resource not found"}},{status:404});
  return NextResponse.json({data:resource});
}
