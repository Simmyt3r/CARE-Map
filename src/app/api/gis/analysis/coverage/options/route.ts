import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const result=await query<{asset_type:string}>(`
    SELECT DISTINCT asset_type
    FROM assets
    WHERE asset_type IS NOT NULL AND btrim(asset_type)<>''
    ORDER BY asset_type
    LIMIT 200
  `);
  return NextResponse.json({data:{assetTypes:result.rows.map(r=>r.asset_type)}});
}
