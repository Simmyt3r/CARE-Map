import {NextResponse} from "next/server";
import {query} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){const result=await query("SELECT code,name,pilot FROM lgas ORDER BY name");return NextResponse.json({data:result.rows},{headers:{"Cache-Control":"public, max-age=0, s-maxage=120, stale-while-revalidate=120"}});}
