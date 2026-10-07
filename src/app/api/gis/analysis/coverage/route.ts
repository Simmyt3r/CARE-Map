import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {
  isCoverageResourceType,
  isCoverageScenario,
  parseCoverageRadius,
  type CoverageResourceType,
  type CoverageScenario
} from "@/lib/coverage-analysis";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const resourceConfig:Record<CoverageResourceType,{table:string;geom:string;name:string}>={
  borehole:{table:"boreholes",geom:"location",name:"name"},
  asset:{table:"assets",geom:"location",name:"name"}
};

function statusClause(scenario:CoverageScenario){
  return scenario==="functional"?"p.status='functional'":"p.status<>'decommissioned'";
}

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const typeValue=url.searchParams.get("type")||"borehole";
  const scenarioValue=url.searchParams.get("scenario")||"functional";
  const radius=parseCoverageRadius(url.searchParams.get("radius")||"2000");
  const assetType=typeValue==="asset"?String(url.searchParams.get("assetType")||"").trim().slice(0,160):"";

  if(!lga)return error("LGA code is required.");
  if(!isCoverageResourceType(typeValue))return error("Coverage type must be borehole or asset.");
  if(!isCoverageScenario(scenarioValue))return error("Invalid coverage scenario.");
  if(radius==null)return error("Coverage radius must be between 100 m and 50 km.");

  const config=resourceConfig[typeValue];
  const status=statusClause(scenarioValue);
  if(typeValue==="asset"&&assetType){
    const exists=await query("SELECT 1 FROM assets WHERE asset_type=$1 LIMIT 1",[assetType]);
    if(!exists.rowCount)return error("Unknown asset type.");
  }
  const assetFilter=typeValue==="asset"&&assetType?"AND p.asset_type=$4":"";
  const assetSelect=typeValue==="asset"?"p.asset_type":"NULL::text";

  const result=await query(`
    WITH selected_lga AS (
      SELECT code,name,boundary,boundary_source
      FROM lgas
      WHERE code=$1
    ),
    qualifying_points AS (
      SELECT p.id,p.${config.name} name,p.status,${assetSelect} asset_type,p.${config.geom} location,
             ST_Intersects(p.${config.geom},l.boundary) inside_lga
      FROM ${config.table} p
      CROSS JOIN selected_lga l
      WHERE l.boundary IS NOT NULL
        AND ${status}
        ${assetFilter}
        AND ST_DWithin(p.${config.geom}::geography,l.boundary::geography,$2)
    ),
    service_union AS (
      SELECT
        CASE
          WHEN count(*)=0 THEN NULL
          ELSE ST_UnaryUnion(
            ST_Collect(
              ST_Buffer(q.location::geography,$2)::geometry
            )
          )
        END geom
      FROM qualifying_points q
    ),
    clipped AS (
      SELECT
        l.code,l.name,l.boundary,l.boundary_source,
        CASE
          WHEN s.geom IS NULL THEN NULL
          ELSE ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(ST_Intersection(l.boundary,s.geom)),
              3
            )
          )
        END covered
      FROM selected_lga l
      CROSS JOIN service_union s
    ),
    metrics AS (
      SELECT
        c.*,
        CASE
          WHEN c.covered IS NULL OR ST_IsEmpty(c.covered) THEN c.boundary
          ELSE ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(ST_Difference(c.boundary,c.covered)),
              3
            )
          )
        END uncovered
      FROM clipped c
    ),
    gap_parts AS (
      SELECT
        d.geom,
        ST_Area(d.geom::geography)/1000000.0 area_km2
      FROM metrics m
      CROSS JOIN LATERAL ST_Dump(m.uncovered) d
      WHERE m.uncovered IS NOT NULL
        AND NOT ST_IsEmpty(m.uncovered)
        AND ST_Area(d.geom::geography)>1000
    ),
    gap_ranked AS (
      SELECT
        row_number() OVER(ORDER BY g.area_km2 DESC)::int gap_rank,
        g.geom,g.area_km2
      FROM gap_parts g
      ORDER BY g.area_km2 DESC
      LIMIT 25
    ),
    gap_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type','Feature',
              'geometry',ST_AsGeoJSON(g.geom)::jsonb,
              'properties',jsonb_build_object(
                'rank',g.gap_rank,
                'areaKm2',round(g.area_km2::numeric,3),
                'longitude',ST_X(ST_PointOnSurface(g.geom)),
                'latitude',ST_Y(ST_PointOnSurface(g.geom))
              )
            )
            ORDER BY g.gap_rank
          ),
          '[]'::jsonb
        )
      ) gaps
      FROM gap_ranked g
    ),
    point_features AS (
      SELECT
        count(*)::int resource_count,
        count(*) FILTER(WHERE q.inside_lga)::int inside_resource_count,
        count(*) FILTER(WHERE NOT q.inside_lga)::int external_supporting_count,
        jsonb_build_object(
          'type','FeatureCollection',
          'features',COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'type','Feature',
                'id',q.id,
                'geometry',ST_AsGeoJSON(q.location)::jsonb,
                'properties',jsonb_build_object(
                  'id',q.id,
                  'name',q.name,
                  'status',q.status,
                  'assetType',q.asset_type,
                  'entityType',$3::text,
                  'insideLga',q.inside_lga
                )
              )
              ORDER BY q.name
            ),
            '[]'::jsonb
          )
        ) resources
      FROM qualifying_points q
    )
    SELECT
      m.code,m.name,m.boundary_source,
      p.resource_count,p.inside_resource_count,p.external_supporting_count,
      round((ST_Area(m.boundary::geography)/1000000.0)::numeric,3) lga_area_km2,
      round((
        CASE WHEN m.covered IS NULL OR ST_IsEmpty(m.covered)
          THEN 0
          ELSE ST_Area(m.covered::geography)/1000000.0
        END
      )::numeric,3) covered_area_km2,
      round((
        CASE WHEN m.uncovered IS NULL OR ST_IsEmpty(m.uncovered)
          THEN 0
          ELSE ST_Area(m.uncovered::geography)/1000000.0
        END
      )::numeric,3) uncovered_area_km2,
      round((
        CASE
          WHEN ST_Area(m.boundary::geography)=0 THEN 0
          WHEN m.covered IS NULL OR ST_IsEmpty(m.covered) THEN 0
          ELSE (ST_Area(m.covered::geography)/ST_Area(m.boundary::geography))*100
        END
      )::numeric,2) coverage_pct,
      ST_AsGeoJSON(m.boundary)::json boundary,
      CASE WHEN m.covered IS NULL OR ST_IsEmpty(m.covered) THEN NULL ELSE ST_AsGeoJSON(m.covered)::json END covered,
      CASE WHEN m.uncovered IS NULL OR ST_IsEmpty(m.uncovered) THEN NULL ELSE ST_AsGeoJSON(m.uncovered)::json END uncovered,
      p.resources,g.gaps
    FROM metrics m
    CROSS JOIN point_features p
    CROSS JOIN gap_features g
  `,typeValue==="asset"&&assetType?[lga,radius,typeValue,assetType]:[lga,radius,typeValue]);

  if(!result.rowCount)return error("LGA not found.",404);
  const row=result.rows[0];
  if(!row.boundary)return error("This LGA does not have an imported administrative boundary yet.",409,"BOUNDARY_REQUIRED");

  return NextResponse.json({
    data:{
      lga:{code:row.code,name:row.name,boundarySource:row.boundary_source},
      resourceType:typeValue,
      assetType:assetType||null,
      scenario:scenarioValue,
      radiusM:radius,
      resourceCount:Number(row.resource_count||0),
      insideResourceCount:Number(row.inside_resource_count||0),
      externalSupportingCount:Number(row.external_supporting_count||0),
      lgaAreaKm2:Number(row.lga_area_km2||0),
      coveredAreaKm2:Number(row.covered_area_km2||0),
      uncoveredAreaKm2:Number(row.uncovered_area_km2||0),
      coveragePct:Number(row.coverage_pct||0),
      boundary:row.boundary,
      covered:row.covered,
      uncovered:row.uncovered,
      resources:row.resources,
      gaps:row.gaps
    },
    methodology:{
      measure:"territorial_area",
      populationCoverage:false,
      note:scenarioValue==="functional"
        ?("Coverage represents LGA land area within the selected straight-line radius of resources currently marked functional"+(assetType?" and belonging to asset type '" + assetType + "'":"")+". It does not estimate population served, travel time, road access, hydraulic capacity or service reliability.")
        :("This is an infrastructure proximity footprint using all non-decommissioned mapped resources"+(assetType?" belonging to asset type '" + assetType + "'":"")+", including records that may be non-functional or need maintenance. It is not an active-service coverage estimate.")
    }
  });
}
