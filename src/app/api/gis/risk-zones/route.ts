import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const hazard=String(url.searchParams.get("hazard")||"").trim().toLowerCase();
  const verifiedParam=url.searchParams.get("verified");
  const format=url.searchParams.get("format")||"";
  const clauses:string[]=[];
  const params:unknown[]=[];

  if(hazard){params.push(hazard);clauses.push("z.hazard_type=$"+params.length);}
  if(verifiedParam==="1"||verifiedParam==="0"){
    params.push(verifiedParam==="1");
    clauses.push("z.verified=$"+params.length);
  }
  const where=clauses.length?"WHERE "+clauses.join(" AND "):"";

  if(format==="geojson"){
    const result=await query(`
      SELECT z.id,z.zone_code,z.name,z.hazard_type,z.severity,z.source,z.source_date,
             z.valid_from,z.valid_to,z.verified,z.notes,
             ST_AsGeoJSON(z.boundary)::json geometry,
             round((ST_Area(z.boundary::geography)/1000000.0)::numeric,3) area_km2
      FROM environmental_risk_zones z
      ${where}
      ORDER BY CASE z.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,z.name
      LIMIT 5000
    `,params);
    return NextResponse.json({
      type:"FeatureCollection",
      features:result.rows.map((r:any)=>({
        type:"Feature",
        id:r.id,
        geometry:r.geometry,
        properties:{
          id:r.id,zoneCode:r.zone_code,name:r.name,hazardType:r.hazard_type,
          severity:r.severity,source:r.source,sourceDate:r.source_date,
          validFrom:r.valid_from,validTo:r.valid_to,verified:r.verified,
          notes:r.notes,areaKm2:r.area_km2
        }
      }))
    });
  }

  const [summary,recent,imports]=await Promise.all([
    query(`
      SELECT count(*)::int total,
        count(*) FILTER(WHERE verified)::int verified,
        count(*) FILTER(WHERE severity='critical')::int critical,
        count(*) FILTER(WHERE severity='high')::int high,
        count(DISTINCT source)::int source_datasets,
        count(DISTINCT hazard_type)::int hazard_types
      FROM environmental_risk_zones
    `),
    query(`
      SELECT z.id,z.zone_code,z.name,z.hazard_type,z.severity,z.source,z.source_date,
             z.valid_from,z.valid_to,z.verified,z.notes,z.created_at,
             round((ST_Area(z.boundary::geography)/1000000.0)::numeric,3) area_km2
      FROM environmental_risk_zones z
      ${where}
      ORDER BY z.created_at DESC
      LIMIT 250
    `,params),
    query(`
      SELECT i.id,i.source,i.verified_on_import,i.total_features,i.imported_features,
             i.failed_features,i.created_at,u.name created_by_name
      FROM environmental_risk_zone_imports i
      LEFT JOIN users u ON u.id=i.created_by
      ORDER BY i.created_at DESC
      LIMIT 12
    `)
  ]);

  return NextResponse.json({
    data:recent.rows,
    imports:imports.rows,
    summary:summary.rows[0]||{total:0,verified:0,critical:0,high:0,source_datasets:0,hazard_types:0}
  });
}
