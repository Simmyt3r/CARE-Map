import {NextResponse} from "next/server";
import {query} from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Public liveness check: never disclose database configuration or SQL errors. */
export async function GET(){
 try{
  await query("SELECT 1");
  return NextResponse.json({ok:true,service:"care-map",database:true},
    {headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const code=e&&typeof e==="object"&&"code" in e?String(e.code):"UNAVAILABLE";
  console.error("CARE-Map health database check failed",{code});
  return NextResponse.json({ok:false,service:"care-map",database:false},
    {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
