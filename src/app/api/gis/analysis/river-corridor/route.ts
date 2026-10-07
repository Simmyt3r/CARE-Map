import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {parseRiverCorridorRadius} from "@/lib/river-corridor";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const radius=parseRiverCorridorRadius(url.searchParams.get("radius")||"500");
  const riverId=String(url.searchParams.get("riverId")||"").trim();

  if(!lga)return error("LGA code is required.");
  if(radius==null)return error("River corridor radius must be between 50 m and 20 km.");

  const result=await query(`
    WITH selected_lga AS (
      SELECT code,name,boundary,boundary_source
      FROM lgas
      WHERE code=$1
    ),
    selected_rivers AS (
      SELECT r.id,
        COALESCE(NULLIF(r.name,''),NULLIF(r.local_name,''),'Unnamed river') name,
        r.local_name,
        ST_CollectionExtract(ST_Intersection(r.course,l.boundary),2) segment
      FROM rivers r
      CROSS JOIN selected_lga l
      WHERE r.verified=TRUE
        AND l.boundary IS NOT NULL
        AND ST_Intersects(r.course,l.boundary)
        AND ($3::uuid IS NULL OR r.id=$3::uuid)
    ),
    river_union AS (
      SELECT
        count(*)::int river_count,
        COALESCE(sum(ST_Length(segment::geography))/1000.0,0) river_length_km,
        CASE WHEN count(*)=0 THEN NULL ELSE ST_UnaryUnion(ST_Collect(segment)) END geom
      FROM selected_rivers
    ),
    corridor AS (
      SELECT
        l.code,l.name,l.boundary_source,l.boundary,
        ru.river_count,ru.river_length_km,ru.geom river_geom,
        CASE
          WHEN ru.geom IS NULL THEN NULL
          ELSE ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(
                ST_Intersection(
                  l.boundary,
                  ST_Buffer(ru.geom::geography,$2)::geometry
                )
              ),3
            )
          )
        END geom
      FROM selected_lga l
      CROSS JOIN river_union ru
    ),
    exposure_rows AS (
      SELECT
        'settlement'::text entity_type,
        s.id,
        s.name,
        s.settlement_type status,
        s.lga_code,
        s.population,
        s.population_source,
        s.location geom,
        ST_Distance(s.location::geography,c.river_geom::geography) distance_m
      FROM settlements s
      CROSS JOIN corridor c
      WHERE s.verified=TRUE
        AND c.geom IS NOT NULL
        AND ST_Intersects(s.location,c.geom)

      UNION ALL

      SELECT
        'borehole',b.id,b.name,b.status,b.lga_code,
        NULL::integer,NULL::text,b.location,
        ST_Distance(b.location::geography,c.river_geom::geography)
      FROM boreholes b
      CROSS JOIN corridor c
      WHERE b.status<>'decommissioned'
        AND c.geom IS NOT NULL
        AND ST_Intersects(b.location,c.geom)

      UNION ALL

      SELECT
        'asset',a.id,a.name,a.status,a.lga_code,
        NULL::integer,NULL::text,a.location,
        ST_Distance(a.location::geography,c.river_geom::geography)
      FROM assets a
      CROSS JOIN corridor c
      WHERE a.status<>'decommissioned'
        AND c.geom IS NOT NULL
        AND ST_Intersects(a.location,c.geom)

      UNION ALL

      SELECT
        'report',r.id,left(r.description,160),r.status,NULL::text,
        NULL::integer,NULL::text,r.location,
        ST_Distance(r.location::geography,c.river_geom::geography)
      FROM reports r
      CROSS JOIN corridor c
      WHERE r.status NOT IN ('resolved','rejected')
        AND c.geom IS NOT NULL
        AND ST_Intersects(r.location,c.geom)
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
                  'distanceM',round(distance_m::numeric,1),
                  'population',population,
                  'populationSource',population_source
                )
              )
              ORDER BY distance_m,entity_type,name
            ),
            '[]'::jsonb
          )
        ) features
      FROM exposure_rows
    ),
    river_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'type','Feature',
              'id',id,
              'geometry',ST_AsGeoJSON(segment)::jsonb,
              'properties',jsonb_build_object(
                'id',id,
                'name',name,
                'localName',local_name
              )
            )
            ORDER BY name
          ),
          '[]'::jsonb
        )
      ) rivers
      FROM selected_rivers
    )
    SELECT
      c.code,c.name,c.boundary_source,
      c.river_count,
      round(c.river_length_km::numeric,2) river_length_km,
      CASE WHEN c.geom IS NULL THEN 0 ELSE round((ST_Area(c.geom::geography)/1000000.0)::numeric,3) END corridor_area_km2,
      ST_AsGeoJSON(c.boundary)::json boundary,
      CASE WHEN c.geom IS NULL THEN NULL ELSE ST_AsGeoJSON(c.geom)::json END corridor,
      es.total_exposed,es.settlements_exposed,es.boreholes_exposed,es.assets_exposed,es.open_reports_exposed,
      es.settlements_with_population,es.known_population_exposed,
      es.features,rf.rivers
    FROM corridor c
    CROSS JOIN exposure_stats es
    CROSS JOIN river_features rf
  `,[lga,radius,riverId||null]);

  if(!result.rowCount)return error("LGA not found.",404);
  const row=result.rows[0];
  if(!row.boundary)return error("This LGA does not have an imported administrative boundary yet.",409,"BOUNDARY_REQUIRED");
  if(Number(row.river_count||0)===0)return error(riverId?"Selected verified river does not intersect this LGA.":"No verified river geometry intersects this LGA.",409,"RIVER_DATA_REQUIRED");

  return NextResponse.json({
    data:{
      lga:{code:row.code,name:row.name,boundarySource:row.boundary_source},
      radiusM:radius,
      riverId:riverId||null,
      riverCount:Number(row.river_count||0),
      riverLengthKm:Number(row.river_length_km||0),
      corridorAreaKm2:Number(row.corridor_area_km2||0),
      totalExposed:Number(row.total_exposed||0),
      settlementsExposed:Number(row.settlements_exposed||0),
      boreholesExposed:Number(row.boreholes_exposed||0),
      assetsExposed:Number(row.assets_exposed||0),
      openReportsExposed:Number(row.open_reports_exposed||0),
      settlementsWithPopulation:Number(row.settlements_with_population||0),
      knownPopulationExposed:Number(row.known_population_exposed||0),
      boundary:row.boundary,
      corridor:row.corridor,
      rivers:row.rivers,
      features:row.features
    },
    methodology:{
      measure:"river_proximity_exposure",
      floodRisk:false,
      note:"This analysis identifies mapped features within the selected straight-line distance of verified river geometry. River proximity alone does not establish flood hazard or erosion risk; elevation, terrain, drainage, rainfall, historical inundation and field evidence are required for hazard conclusions."
    }
  });
}
