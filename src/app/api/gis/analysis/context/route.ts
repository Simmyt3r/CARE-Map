import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {parsePoint,resolveSpatialContext} from "@/lib/spatial-context";
import {normalizeAoi} from "@/lib/remote-sensing";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

/** Safe geographical context for already-authorized staff only. */
export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  const params=new URL(request.url).searchParams;
  try{
    const point=parsePoint(params.get("lat"),params.get("lng"));
    const radius=Number(params.get("radius")||2500);
    if(!Number.isFinite(radius)||radius<0||radius>5000)
      return error("Search radius must be between 0 and 5000 metres.");
    const context=await resolveSpatialContext(point,radius);
    return NextResponse.json({data:context},{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    return error(e instanceof Error?e.message:"Unable to identify location.",400);
  }
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required.",403,"FORBIDDEN");
  if(request.headers.get("origin")!==new URL(request.url).origin)
    return error("Invalid request origin.",403,"INVALID_ORIGIN");
  const raw=await request.text();
  if(raw.length>65_000)return error("Area of interest is too large.",413);
  let body:{geometry?:unknown;radiusM?:number}|null=null;
  try{body=JSON.parse(raw);}catch{return error("Invalid JSON.",400);}
  if(!body?.geometry)return error("Area of interest geometry is required.");
  try{
    const geometry=normalizeAoi(body.geometry);
    const radius=body.radiusM??2500;
    if(!Number.isFinite(radius)||radius<0||radius>5000)
      return error("Search radius must be between 0 and 5000 metres.");
    const context=await resolveSpatialContext(geometry,radius);
    return NextResponse.json({data:context},{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    return error(e instanceof Error?e.message:"Unable to identify area.",400);
  }
}
