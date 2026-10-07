import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {environmentalSeverityRank,isEnvironmentalHazardType,isEnvironmentalSeverity} from "@/lib/environmental-risk";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const hazard=String(url.searchParams.get("hazard")||"").trim().toLowerCase();
  const minimumSeverity=String(url.searchParams.get("severity")||"low").trim().toLowerCase();
  const includeUnverified=url.searchParams.get("includeUnverified")==="1";

  if(hazard&&!isEnvironmentalHazardType(hazard))return error("Invalid hazard type.");
  if(!isEnvironmentalSeverity(minimumSeverity))return error("Invalid minimum severity.");
  const severityRank=environmentalSeverityRank(minimumSeverity);

  if(lga){
    const check=await query<{boundary_loaded:boolean}>(
      "SELECT (boundary IS NOT NULL) boundary_loaded FROM lgas WHERE code=$1",
      [lga]
    );
    if(!check.rowCount)return error("LGA not found.",404);
    if(!check.rows[0].boundary_loaded)return error("This LGA does not have an imported administrative boundary yet.",409,"BOUNDARY_REQUIRED");
  }

  const result=await query(`
    WITH scope AS (
      SELECT
        $1::text lga_code,
        CASE
          WHEN $1::text='' THEN NULL
          ELSE (SELECT boundary FROM lgas WHERE code=$1)
        END lga_boundary
    ),
    filtered_zones AS (
      SELECT z.*,
        CASE
          WHEN s.lga_code='' THEN z.boundary
          ELSE ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(ST_Intersection(z.boundary,s.lga_boundary)),
              3
            )
          )
        END geom
      FROM environmental_risk_zones z
      CROSS JOIN scope s
      WHERE ($4::boolean OR z.verified=TRUE)
        AND ($2::text='' OR z.hazard_type=$2)
        AND (CASE z.severity
          WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END) >= $3
        AND (s.lga_code='' OR ST_Intersects(z.boundary,s.lga_boundary))
    ),
    usable_zones AS (
      SELECT * FROM filtered_zones
      WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
    ),
    zone_union AS (
      SELECT CASE WHEN count(*)=0 THEN NULL ELSE ST_UnaryUnion(ST_Collect(geom)) END geom
      FROM usable_zones
    ),
    scope_settlements AS (
      SELECT s.*
      FROM settlements s
      CROSS JOIN scope sc
      WHERE s.verified=TRUE
        AND (sc.lga_code='' OR ST_Intersects(s.location,sc.lga_boundary))
    ),
    scope_boreholes AS (
      SELECT b.*
      FROM boreholes b
      CROSS JOIN scope sc
      WHERE b.status<>'decommissioned'
        AND (sc.lga_code='' OR ST_Intersects(b.location,sc.lga_boundary))
    ),
    scope_assets AS (
      SELECT a.*
      FROM assets a
      CROSS JOIN scope sc
      WHERE a.status<>'decommissioned'
        AND (sc.lga_code='' OR ST_Intersects(a.location,sc.lga_boundary))
    ),
    scope_forests AS (
      SELECT f.*
      FROM forest_sites f
      CROSS JOIN scope sc
      WHERE sc.lga_code='' OR ST_Intersects(f.boundary,sc.lga_boundary)
    ),
    scope_reports AS (
      SELECT r.*
      FROM reports r
      CROSS JOIN scope sc
      WHERE r.status NOT IN ('resolved','rejected')
        AND (sc.lga_code='' OR ST_Intersects(r.location,sc.lga_boundary))
    ),
    exposed_settlements AS (
      SELECT s.* FROM scope_settlements s CROSS JOIN zone_union u
      WHERE u.geom IS NOT NULL AND ST_Intersects(s.location,u.geom)
    ),
    exposed_boreholes AS (
      SELECT b.* FROM scope_boreholes b CROSS JOIN zone_union u
      WHERE u.geom IS NOT NULL AND ST_Intersects(b.location,u.geom)
    ),
    exposed_assets AS (
      SELECT a.* FROM scope_assets a CROSS JOIN zone_union u
      WHERE u.geom IS NOT NULL AND ST_Intersects(a.location,u.geom)
    ),
    exposed_forests AS (
      SELECT f.* FROM scope_forests f CROSS JOIN zone_union u
      WHERE u.geom IS NOT NULL AND ST_Intersects(f.boundary,u.geom)
    ),
    exposed_reports AS (
      SELECT r.* FROM scope_reports r CROSS JOIN zone_union u
      WHERE u.geom IS NOT NULL AND ST_Intersects(r.location,u.geom)
    ),
    zone_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'id',z.id,
          'geometry',ST_AsGeoJSON(z.geom)::jsonb,
          'properties',jsonb_build_object(
            'id',z.id,'zoneCode',z.zone_code,'name',z.name,
            'hazardType',z.hazard_type,'severity',z.severity,
            'verified',z.verified,'source',z.source,'sourceDate',z.source_date,
            'areaKm2',round((ST_Area(z.geom::geography)/1000000.0)::numeric,3),
            'settlementCount',(SELECT count(*) FROM scope_settlements s WHERE ST_Intersects(s.location,z.geom)),
            'knownPopulation',(SELECT COALESCE(sum(s.population),0) FROM scope_settlements s WHERE s.population IS NOT NULL AND ST_Intersects(s.location,z.geom)),
            'boreholeCount',(SELECT count(*) FROM scope_boreholes b WHERE ST_Intersects(b.location,z.geom)),
            'assetCount',(SELECT count(*) FROM scope_assets a WHERE ST_Intersects(a.location,z.geom)),
            'forestSiteCount',(SELECT count(*) FROM scope_forests f WHERE ST_Intersects(f.boundary,z.geom)),
            'openReportCount',(SELECT count(*) FROM scope_reports r WHERE ST_Intersects(r.location,z.geom))
          )
        ) ORDER BY CASE z.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,z.name),'[]'::jsonb)
      ) zones
      FROM usable_zones z
    ),
    settlement_features AS (
      SELECT jsonb_build_object('type','FeatureCollection','features',COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature','id',s.id,'geometry',ST_AsGeoJSON(s.location)::jsonb,
        'properties',jsonb_build_object(
          'id',s.id,'entityType','settlement','name',s.name,'lga',s.lga_code,
          'population',s.population,'populationYear',s.population_year,'populationSource',s.population_source
        )
      ) ORDER BY s.name),'[]'::jsonb)) data
      FROM (SELECT * FROM exposed_settlements ORDER BY name LIMIT 5000) s
    ),
    borehole_features AS (
      SELECT jsonb_build_object('type','FeatureCollection','features',COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature','id',b.id,'geometry',ST_AsGeoJSON(b.location)::jsonb,
        'properties',jsonb_build_object('id',b.id,'entityType','borehole','name',b.name,'status',b.status,'lga',b.lga_code)
      ) ORDER BY b.name),'[]'::jsonb)) data
      FROM (SELECT * FROM exposed_boreholes ORDER BY name LIMIT 3000) b
    ),
    asset_features AS (
      SELECT jsonb_build_object('type','FeatureCollection','features',COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature','id',a.id,'geometry',ST_AsGeoJSON(a.location)::jsonb,
        'properties',jsonb_build_object('id',a.id,'entityType','asset','name',a.name,'assetType',a.asset_type,'status',a.status,'lga',a.lga_code)
      ) ORDER BY a.name),'[]'::jsonb)) data
      FROM (SELECT * FROM exposed_assets ORDER BY name LIMIT 3000) a
    ),
    forest_features AS (
      SELECT jsonb_build_object('type','FeatureCollection','features',COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature','id',f.id,'geometry',ST_AsGeoJSON(f.boundary)::jsonb,
        'properties',jsonb_build_object('id',f.id,'entityType','forest_site','name',f.name,'status',f.status,'lga',f.lga_code)
      ) ORDER BY f.name),'[]'::jsonb)) data
      FROM (SELECT * FROM exposed_forests ORDER BY name LIMIT 1000) f
    ),
    report_features AS (
      SELECT jsonb_build_object('type','FeatureCollection','features',COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature','id',r.id,'geometry',ST_AsGeoJSON(r.location)::jsonb,
        'properties',jsonb_build_object('id',r.id,'entityType','report','name',left(r.description,100),'status',r.status,'priority',r.priority)
      ) ORDER BY r.submitted_at DESC),'[]'::jsonb)) data
      FROM (SELECT * FROM exposed_reports ORDER BY submitted_at DESC LIMIT 2000) r
    )
    SELECT
      (SELECT count(*) FROM usable_zones)::int zone_count,
      (SELECT count(*) FROM scope_settlements)::int settlement_total,
      (SELECT count(*) FROM exposed_settlements)::int settlement_exposed,
      (SELECT count(*) FROM scope_settlements WHERE population IS NOT NULL)::int settlement_population_known,
      (SELECT count(*) FROM exposed_settlements WHERE population IS NOT NULL)::int exposed_population_known,
      (SELECT COALESCE(sum(population),0) FROM scope_settlements WHERE population IS NOT NULL)::bigint known_population_total,
      (SELECT COALESCE(sum(population),0) FROM exposed_settlements WHERE population IS NOT NULL)::bigint known_population_exposed,
      (SELECT count(*) FROM scope_boreholes)::int borehole_total,
      (SELECT count(*) FROM exposed_boreholes)::int borehole_exposed,
      (SELECT count(*) FROM scope_assets)::int asset_total,
      (SELECT count(*) FROM exposed_assets)::int asset_exposed,
      (SELECT count(*) FROM scope_forests)::int forest_total,
      (SELECT count(*) FROM exposed_forests)::int forest_exposed,
      (SELECT count(*) FROM scope_reports)::int open_report_total,
      (SELECT count(*) FROM exposed_reports)::int open_report_exposed,
      (SELECT COALESCE(sum(ST_Area(ST_Intersection(f.boundary,u.geom)::geography))/10000.0,0)
        FROM exposed_forests f CROSS JOIN zone_union u WHERE u.geom IS NOT NULL)::numeric(14,2) exposed_forest_area_ha,
      zf.zones,sf.data settlements,bf.data boreholes,af.data assets,ff.data forests,rf.data reports
    FROM zone_features zf
    CROSS JOIN settlement_features sf
    CROSS JOIN borehole_features bf
    CROSS JOIN asset_features af
    CROSS JOIN forest_features ff
    CROSS JOIN report_features rf
  `,[lga,hazard,severityRank,includeUnverified]);

  const row=result.rows[0];
  const settlementTotal=Number(row.settlement_total||0);
  const settlementExposed=Number(row.settlement_exposed||0);
  const knownPopulationTotal=Number(row.known_population_total||0);
  const knownPopulationExposed=Number(row.known_population_exposed||0);

  return NextResponse.json({
    data:{
      filters:{lga:lga||null,hazardType:hazard||null,minimumSeverity,includeUnverified},
      zoneCount:Number(row.zone_count||0),
      summary:{
        settlements:{total:settlementTotal,exposed:settlementExposed,exposurePct:settlementTotal?Number(((settlementExposed/settlementTotal)*100).toFixed(2)):0},
        population:{
          knownSettlements:Number(row.settlement_population_known||0),
          exposedKnownSettlements:Number(row.exposed_population_known||0),
          knownTotal:knownPopulationTotal,
          knownExposed:knownPopulationExposed,
          knownExposurePct:knownPopulationTotal?Number(((knownPopulationExposed/knownPopulationTotal)*100).toFixed(2)):null,
          completenessPct:settlementTotal?Number((Number(row.settlement_population_known||0)/settlementTotal*100).toFixed(2)):0
        },
        boreholes:{total:Number(row.borehole_total||0),exposed:Number(row.borehole_exposed||0)},
        assets:{total:Number(row.asset_total||0),exposed:Number(row.asset_exposed||0)},
        forests:{total:Number(row.forest_total||0),exposed:Number(row.forest_exposed||0),exposedAreaHa:Number(row.exposed_forest_area_ha||0)},
        openReports:{total:Number(row.open_report_total||0),exposed:Number(row.open_report_exposed||0)}
      },
      zones:row.zones,
      settlements:row.settlements,
      boreholes:row.boreholes,
      assets:row.assets,
      forests:row.forests,
      reports:row.reports
    },
    methodology:{
      hazardSource:"imported_verified_polygons_by_default",
      settlementBasis:"verified_settlements_only",
      populationBasis:"known_sourced_population_only",
      note:"Exposure means a mapped feature intersects the selected imported hazard-zone geometry. It does not prove damage, probability of occurrence, event timing, vulnerability, loss magnitude or household-level impact."
    }
  });
}
