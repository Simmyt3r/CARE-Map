import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {isHazardSeverity,isHazardType} from "@/lib/hazard-zones";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function severityFromRank(rank:number){
  if(rank>=4)return "critical";
  if(rank===3)return "high";
  if(rank===2)return "medium";
  if(rank===1)return "low";
  return "unknown";
}

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const zoneId=String(url.searchParams.get("zoneId")||"").trim();
  const hazardType=String(url.searchParams.get("hazardType")||"").trim().toLowerCase();
  const severity=String(url.searchParams.get("severity")||"").trim().toLowerCase();

  if(!lga)return error("LGA code is required.");
  if(zoneId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(zoneId))return error("Invalid hazard zone ID.");
  if(hazardType&&!isHazardType(hazardType))return error("Invalid hazard type.");
  if(severity&&!isHazardSeverity(severity))return error("Invalid hazard severity.");

  const result=await query(`
    WITH selected_lga AS (
      SELECT code,name,boundary,boundary_source
      FROM lgas
      WHERE code=$1
    ),
    raw_zones AS (
      SELECT
        h.id,h.name,h.hazard_type,h.severity,h.source,h.source_date,h.method,
        ST_Multi(
          ST_CollectionExtract(
            ST_MakeValid(ST_Intersection(h.boundary,l.boundary)),
            3
          )
        ) geom
      FROM hazard_zones h
      CROSS JOIN selected_lga l
      WHERE h.verified=TRUE
        AND l.boundary IS NOT NULL
        AND ST_Intersects(h.boundary,l.boundary)
        AND ($2::uuid IS NULL OR h.id=$2::uuid)
        AND ($3::text IS NULL OR h.hazard_type=$3::text)
        AND ($4::text IS NULL OR h.severity=$4::text)
    ),
    selected_zones AS (
      SELECT *
      FROM raw_zones
      WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
    ),
    hazard_union AS (
      SELECT
        count(*)::int zone_count,
        CASE WHEN count(*)=0 THEN NULL ELSE ST_UnaryUnion(ST_Collect(geom)) END geom,
        COALESCE(max(
          CASE severity
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END
        ),0)::int highest_severity_rank
      FROM selected_zones
    ),
    zone_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type','Feature',
              'id',z.id,
              'geometry',ST_AsGeoJSON(z.geom)::jsonb,
              'properties',jsonb_build_object(
                'id',z.id,
                'name',z.name,
                'hazardType',z.hazard_type,
                'severity',z.severity,
                'source',z.source,
                'sourceDate',z.source_date,
                'method',z.method
              )
            )
            ORDER BY
              CASE z.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
              z.name
          ),
          '[]'::jsonb
        )
      ) zones
      FROM selected_zones z
    ),
    exposure_rows AS (
      SELECT
        'settlement'::text entity_type,
        s.id,s.name,s.settlement_type status,s.lga_code,
        s.population,s.population_source,s.location geom
      FROM settlements s
      CROSS JOIN hazard_union h
      WHERE s.verified=TRUE
        AND h.geom IS NOT NULL
        AND ST_Covers(h.geom,s.location)

      UNION ALL

      SELECT
        'borehole',b.id,b.name,b.status,b.lga_code,
        NULL::integer,NULL::text,b.location
      FROM boreholes b
      CROSS JOIN hazard_union h
      WHERE b.status<>'decommissioned'
        AND h.geom IS NOT NULL
        AND ST_Covers(h.geom,b.location)

      UNION ALL

      SELECT
        'asset',a.id,a.name,a.status,a.lga_code,
        NULL::integer,NULL::text,a.location
      FROM assets a
      CROSS JOIN hazard_union h
      WHERE a.status<>'decommissioned'
        AND h.geom IS NOT NULL
        AND ST_Covers(h.geom,a.location)

      UNION ALL

      SELECT
        'report',r.id,left(r.description,160),r.status,NULL::text,
        NULL::integer,NULL::text,r.location
      FROM reports r
      CROSS JOIN hazard_union h
      WHERE r.status NOT IN ('resolved','rejected')
        AND h.geom IS NOT NULL
        AND ST_Covers(h.geom,r.location)
    ),
    exposure_stats AS (
      SELECT
        count(*)::int total_exposed,
        count(*) FILTER(WHERE entity_type='settlement')::int settlements_exposed,
        count(*) FILTER(WHERE entity_type='borehole')::int boreholes_exposed,
        count(*) FILTER(WHERE entity_type='asset')::int assets_exposed,
        count(*) FILTER(WHERE entity_type='report')::int open_reports_exposed,
        count(*) FILTER(WHERE entity_type='settlement' AND population IS NOT NULL)::int settlements_with_population,
        COALESCE(sum(population) FILTER(WHERE entity_type='settlement' AND population IS NOT NULL),0)::bigint known_population_exposed,
        jsonb_build_object(
          'type','FeatureCollection',
          'features',COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type','Feature',
                'id',id,
                'geometry',ST_AsGeoJSON(geom)::jsonb,
                'properties',jsonb_build_object(
                  'id',id,
                  'entityType',entity_type,
                  'name',name,
                  'status',status,
                  'lga',lga_code,
                  'population',population,
                  'populationSource',population_source
                )
              )
              ORDER BY entity_type,name
            ),
            '[]'::jsonb
          )
        ) features
      FROM exposure_rows
    )
    SELECT
      l.code,l.name,l.boundary_source,
      hu.zone_count,hu.highest_severity_rank,
      round((ST_Area(l.boundary::geography)/1000000.0)::numeric,3) lga_area_km2,
      CASE WHEN hu.geom IS NULL THEN 0 ELSE round((ST_Area(hu.geom::geography)/1000000.0)::numeric,3) END hazard_area_km2,
      CASE
        WHEN l.boundary IS NULL OR ST_Area(l.boundary::geography)=0 OR hu.geom IS NULL THEN 0
        ELSE round(((ST_Area(hu.geom::geography)/ST_Area(l.boundary::geography))*100)::numeric,2)
      END hazard_area_pct,
      ST_AsGeoJSON(l.boundary)::json boundary,
      CASE WHEN hu.geom IS NULL THEN NULL ELSE ST_AsGeoJSON(hu.geom)::json END hazard_union,
      es.total_exposed,es.settlements_exposed,es.boreholes_exposed,es.assets_exposed,es.open_reports_exposed,
      es.settlements_with_population,es.known_population_exposed,
      es.features,zf.zones
    FROM selected_lga l
    CROSS JOIN hazard_union hu
    CROSS JOIN exposure_stats es
    CROSS JOIN zone_features zf
  `,[
    lga,
    zoneId||null,
    hazardType||null,
    severity||null
  ]);

  if(!result.rowCount)return error("LGA not found.",404);
  const row=result.rows[0];
  if(!row.boundary)return error("This LGA does not have an imported administrative boundary yet.",409,"BOUNDARY_REQUIRED");
  if(Number(row.zone_count||0)===0)return error("No verified hazard zones match this LGA and filter.",409,"HAZARD_DATA_REQUIRED");

  return NextResponse.json({
    data:{
      lga:{code:row.code,name:row.name,boundarySource:row.boundary_source},
      zoneId:zoneId||null,
      hazardType:hazardType||null,
      severity:severity||null,
      zoneCount:Number(row.zone_count||0),
      highestSeverity:severityFromRank(Number(row.highest_severity_rank||0)),
      lgaAreaKm2:Number(row.lga_area_km2||0),
      hazardAreaKm2:Number(row.hazard_area_km2||0),
      hazardAreaPct:Number(row.hazard_area_pct||0),
      totalExposed:Number(row.total_exposed||0),
      settlementsExposed:Number(row.settlements_exposed||0),
      boreholesExposed:Number(row.boreholes_exposed||0),
      assetsExposed:Number(row.assets_exposed||0),
      openReportsExposed:Number(row.open_reports_exposed||0),
      settlementsWithPopulation:Number(row.settlements_with_population||0),
      knownPopulationExposed:Number(row.known_population_exposed||0),
      boundary:row.boundary,
      hazardUnion:row.hazard_union,
      zones:row.zones,
      features:row.features
    },
    methodology:{
      measure:"verified_polygon_exposure",
      note:"Exposure means a mapped point lies inside at least one verified imported hazard polygon after clipping to the selected LGA. The result inherits the quality, date, method and limitations of the source hazard dataset; CARE-Map does not independently prove the hazard classification."
    }
  });
}
