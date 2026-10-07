import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const lga=String(new URL(request.url).searchParams.get("lga")||"").trim().toUpperCase();
  if(!lga)return error("LGA code is required.");

  const result=await query(`
    SELECT r.id,
      COALESCE(NULLIF(r.name,''),NULLIF(r.local_name,''),'Unnamed river') name,
      r.local_name,r.lga_code,
      round((
        ST_Length(
          ST_CollectionExtract(ST_Intersection(r.course,l.boundary),2)::geography
        )/1000.0
      )::numeric,2) length_km
    FROM rivers r
    JOIN lgas l ON l.code=$1
    WHERE r.verified=TRUE
      AND l.boundary IS NOT NULL
      AND ST_Intersects(r.course,l.boundary)
    ORDER BY COALESCE(NULLIF(r.name,''),NULLIF(r.local_name,''),'Unnamed river')
    LIMIT 500
  `,[lga]);

  return NextResponse.json({data:result.rows});
}
