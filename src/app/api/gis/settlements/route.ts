import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const verifiedParam=url.searchParams.get("verified");
  const format=url.searchParams.get("format")||"";

  const clauses:string[]=[];
  const params:unknown[]=[];
  if(lga){params.push(lga);clauses.push("s.lga_code=$"+params.length);}
  if(verifiedParam==="1"||verifiedParam==="0"){
    params.push(verifiedParam==="1");
    clauses.push("s.verified=$"+params.length);
  }
  const where=clauses.length?"WHERE "+clauses.join(" AND "):"";

  if(format==="geojson"){
    const result=await query(`
      SELECT s.id,s.settlement_code,s.name,s.settlement_type,s.lga_code,s.population,
             s.population_year,s.population_source,s.source,s.verified,s.gps_accuracy_m,s.notes,
             ST_AsGeoJSON(s.location)::json geometry
      FROM settlements s
      ${where}
      ORDER BY s.name
      LIMIT 10000
    `,params);
    return NextResponse.json({
      type:"FeatureCollection",
      features:result.rows.map((r:any)=>({
        type:"Feature",
        id:r.id,
        geometry:r.geometry,
        properties:{
          id:r.id,
          settlementCode:r.settlement_code,
          name:r.name,
          settlementType:r.settlement_type,
          lgaCode:r.lga_code,
          population:r.population,
          populationYear:r.population_year,
          populationSource:r.population_source,
          source:r.source,
          verified:r.verified,
          gpsAccuracyM:r.gps_accuracy_m,
          notes:r.notes
        }
      }))
    });
  }

  const [summary,recent,imports]=await Promise.all([
    query(`
      SELECT
        count(*)::int total,
        count(*) FILTER(WHERE verified)::int verified,
        count(*) FILTER(WHERE population IS NOT NULL)::int population_known,
        count(DISTINCT lga_code)::int lgas_covered,
        count(DISTINCT source)::int source_datasets
      FROM settlements
    `),
    query(`
      SELECT s.id,s.settlement_code,s.name,s.settlement_type,s.lga_code,s.population,
             s.population_year,s.population_source,s.source,s.verified,s.gps_accuracy_m,
             ST_Y(s.location) latitude,ST_X(s.location) longitude,s.created_at
      FROM settlements s
      ${where}
      ORDER BY s.created_at DESC
      LIMIT 250
    `,params),
    query(`
      SELECT i.id,i.source,i.format,i.verified_on_import,i.total_rows,i.imported_rows,
             i.failed_rows,i.auto_assigned_lga_rows,i.created_at,u.name created_by_name
      FROM settlement_imports i
      LEFT JOIN users u ON u.id=i.created_by
      ORDER BY i.created_at DESC
      LIMIT 12
    `)
  ]);

  return NextResponse.json({
    data:recent.rows,
    imports:imports.rows,
    summary:summary.rows[0]||{total:0,verified:0,population_known:0,lgas_covered:0,source_datasets:0}
  });
}
