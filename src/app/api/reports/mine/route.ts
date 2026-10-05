import {NextResponse} from "next/server";
import {getSession} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
export async function GET(){const s=await getSession();if(!s)return error("Sign in required",401,"UNAUTHENTICATED");const r=await query("SELECT id,type,description,status,submitted_at,resolved_at FROM reports WHERE submitted_by=$1 ORDER BY submitted_at DESC",[s.sub]);return NextResponse.json({data:r.rows});}
