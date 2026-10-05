import {NextResponse} from "next/server";
import {query} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){const result=await query("SELECT code,name,pilot FROM lgas ORDER BY name");return NextResponse.json({data:result.rows});}
