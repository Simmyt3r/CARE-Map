import {NextResponse} from "next/server";
import {query} from "@/lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){try{const db=await query<{now:string}>("SELECT now()");return NextResponse.json({ok:true,service:"care-map",database:true,time:db.rows[0]?.now});}catch(e){return NextResponse.json({ok:false,service:"care-map",database:false,error:e instanceof Error?e.message:"database unavailable"},{status:503});}}
