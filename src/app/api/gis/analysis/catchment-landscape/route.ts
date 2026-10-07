import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const catchmentId=String(new URL(request.url).searchParams.get("catchmentId")||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(catchmentId)){
    return error("A valid catchment ID is required.");
  }

  const result=await query(`
    WITH c AS (
      SELECT id,catchment_code,name,catchment_level,parent_id,boundary,source,source_date,method,notes
      FROM catchments
      WHERE id=$1 AND verified=TRUE
    ),
    lga_rows AS (
      SELECT
        l.code,l.name,
        ST_Area(ST_Intersection(l.boundary,c.boundary)::geography)/1000000.0 overlap_km2
      FROM lgas l
      CROSS JOIN c
      WHERE l.boundary IS NOT NULL
        AND ST_Intersects(l.boundary,c.boundary)
        AND ST_Area(ST_Intersection(l.boundary,c.boundary)::geography)>1000
    ),
    lga_summary AS (
      SELECT
        count(*)::int lga_count,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'code',code,'name',name,'overlapKm2',round(overlap_km2::numeric,3)
          ) ORDER BY overlap_km2 DESC,name
        ),'[]'::jsonb) lgas
      FROM lga_rows
    ),
    settlement_rows AS (
      SELECT s.*
      FROM settlements s
      CROSS JOIN c
      WHERE s.verified=TRUE AND ST_Covers(c.boundary,s.location)
    ),
    settlement_summary AS (
      SELECT
        count(*)::int settlements,
        count(*) FILTER(WHERE population IS NOT NULL)::int settlements_with_population,
        COALESCE(sum(population) FILTER(WHERE population IS NOT NULL),0)::bigint known_population
      FROM settlement_rows
    ),
    borehole_rows AS (
      SELECT b.*
      FROM boreholes b
      CROSS JOIN c
      WHERE b.status<>'decommissioned' AND ST_Covers(c.boundary,b.location)
    ),
    borehole_summary AS (
      SELECT
        count(*)::int boreholes,
        count(*) FILTER(WHERE status='functional')::int functional_boreholes,
        count(*) FILTER(WHERE status IN ('non_functional','needs_maintenance'))::int boreholes_needing_attention
      FROM borehole_rows
    ),
    asset_rows AS (
      SELECT a.*
      FROM assets a
      CROSS JOIN c
      WHERE a.status<>'decommissioned' AND ST_Covers(c.boundary,a.location)
    ),
    asset_summary AS (
      SELECT
        count(*)::int assets,
        count(*) FILTER(WHERE status='functional')::int functional_assets,
        count(*) FILTER(WHERE status IN ('non_functional','needs_maintenance'))::int assets_needing_attention
      FROM asset_rows
    ),
    forest_parts AS (
      SELECT ST_CollectionExtract(ST_MakeValid(ST_Intersection(f.boundary,c.boundary)),3) geom
      FROM forest_sites f
      CROSS JOIN c
      WHERE ST_Intersects(f.boundary,c.boundary)
    ),
    forest_summary AS (
      SELECT
        count(*)::int forest_sites,
        CASE WHEN count(*)=0 THEN 0
          ELSE COALESCE(ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography)/10000.0,0)
        END forest_area_ha
      FROM forest_parts
      WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
    ),
    river_parts AS (
      SELECT r.id,
        COALESCE(NULLIF(r.name,''),NULLIF(r.local_name,''),'Unnamed river') name,
        r.stress_indicator,
        ST_CollectionExtract(ST_Intersection(r.course,c.boundary),2) geom
      FROM rivers r
      CROSS JOIN c
      WHERE r.verified=TRUE AND ST_Intersects(r.course,c.boundary)
    ),
    river_summary AS (
      SELECT
        count(*) FILTER(WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom))::int verified_rivers,
        COALESCE(sum(ST_Length(geom::geography)) FILTER(WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)),0)/1000.0 river_length_km
      FROM river_parts
    ),
    report_rows AS (
      SELECT r.*
      FROM reports r
      CROSS JOIN c
      WHERE r.status NOT IN ('resolved','rejected') AND ST_Covers(c.boundary,r.location)
    ),
    report_summary AS (
      SELECT
        count(*)::int open_reports,
        count(*) FILTER(WHERE priority='critical')::int critical_reports,
        count(*) FILTER(WHERE priority='high')::int high_reports
      FROM report_rows
    ),
    hazard_parts AS (
      SELECT h.id,h.name,h.hazard_type,h.severity,h.source,
        ST_CollectionExtract(ST_MakeValid(ST_Intersection(h.boundary,c.boundary)),3) geom
      FROM hazard_zones h
      CROSS JOIN c
      WHERE h.verified=TRUE AND ST_Intersects(h.boundary,c.boundary)
    ),
    hazard_summary AS (
      SELECT
        count(*) FILTER(WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom))::int verified_hazard_zones,
        CASE WHEN count(*) FILTER(WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom))=0 THEN 0
          ELSE COALESCE(ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography)/1000000.0,0)
        END hazard_area_km2,
        count(*) FILTER(WHERE severity IN ('high','critical') AND geom IS NOT NULL AND NOT ST_IsEmpty(geom))::int high_critical_hazards
      FROM hazard_parts
    ),
    vegetation_summary AS (
      SELECT
        count(*) FILTER(WHERE r.status='completed' AND r.publish_to_map=TRUE)::int published_vegetation_analyses,
        max(r.comparison_date) FILTER(WHERE r.status='completed' AND r.publish_to_map=TRUE) latest_vegetation_date
      FROM remote_sensing_analyses r
      CROSS JOIN c
      WHERE ST_Intersects(r.aoi,c.boundary)
    ),
    alert_summary AS (
      SELECT count(*)::int open_vegetation_alerts
      FROM vegetation_alerts a
      JOIN vegetation_monitors m ON m.id=a.monitor_id
      CROSS JOIN c
      WHERE a.acknowledged_at IS NULL
        AND ST_Intersects(m.aoi,c.boundary)
    ),
    point_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(feature ORDER BY sort_key,display_name),'[]'::jsonb)
      ) features
      FROM (
        SELECT
          1 sort_key,s.name display_name,
          jsonb_build_object(
            'type','Feature','id',s.id,'geometry',ST_AsGeoJSON(s.location)::jsonb,
            'properties',jsonb_build_object(
              'id',s.id,'entityType','settlement','name',s.name,'status',s.settlement_type,
              'population',s.population,'populationSource',s.population_source
            )
          ) feature
        FROM settlement_rows s
        LIMIT 1000
      ) q1
    ),
    borehole_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',b.id,'geometry',ST_AsGeoJSON(b.location)::jsonb,
            'properties',jsonb_build_object(
              'id',b.id,'entityType','borehole','name',b.name,'status',b.status,'riskLevel',b.risk_level
            )
          ) ORDER BY b.name
        ),'[]'::jsonb)
      ) features
      FROM (SELECT * FROM borehole_rows ORDER BY name LIMIT 1000) b
    ),
    asset_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',a.id,'geometry',ST_AsGeoJSON(a.location)::jsonb,
            'properties',jsonb_build_object(
              'id',a.id,'entityType','asset','name',a.name,'status',a.status,
              'assetType',a.asset_type,'riskLevel',a.risk_level
            )
          ) ORDER BY a.name
        ),'[]'::jsonb)
      ) features
      FROM (SELECT * FROM asset_rows ORDER BY name LIMIT 1000) a
    ),
    report_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',r.id,'geometry',ST_AsGeoJSON(r.location)::jsonb,
            'properties',jsonb_build_object(
              'id',r.id,'entityType','report','name',left(r.description,160),
              'status',r.status,'priority',r.priority
            )
          ) ORDER BY r.submitted_at DESC
        ),'[]'::jsonb)
      ) features
      FROM (SELECT * FROM report_rows ORDER BY submitted_at DESC LIMIT 1000) r
    ),
    forest_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',f.id,'geometry',ST_AsGeoJSON(f.geom)::jsonb,
            'properties',jsonb_build_object(
              'id',f.id,'entityType','forest_site','name',f.name,'siteType',f.site_type,
              'status',f.status,'riskLevel',f.risk_level
            )
          ) ORDER BY f.name
        ),'[]'::jsonb)
      ) features
      FROM (
        SELECT fs.id,fs.name,fs.site_type,fs.status,fs.risk_level,
          ST_CollectionExtract(ST_MakeValid(ST_Intersection(fs.boundary,c.boundary)),3) geom
        FROM forest_sites fs
        CROSS JOIN c
        WHERE ST_Intersects(fs.boundary,c.boundary)
        ORDER BY fs.name
        LIMIT 500
      ) f
      WHERE f.geom IS NOT NULL AND NOT ST_IsEmpty(f.geom)
    ),
    vegetation_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',v.id,'geometry',ST_AsGeoJSON(v.geom)::jsonb,
            'properties',jsonb_build_object(
              'id',v.id,'entityType','ndvi_change','name',v.name,
              'comparisonDate',v.comparison_date,'changeLevel',v.change_level,
              'vegetationChangeHa',v.vegetation_change_ha,'vegetationChangePct',v.vegetation_change_pct
            )
          ) ORDER BY v.comparison_date DESC,v.name
        ),'[]'::jsonb)
      ) features
      FROM (
        SELECT r.id,r.name,r.comparison_date,r.change_level,r.vegetation_change_ha,r.vegetation_change_pct,
          ST_CollectionExtract(ST_MakeValid(ST_Intersection(r.aoi,c.boundary)),3) geom
        FROM remote_sensing_analyses r
        CROSS JOIN c
        WHERE r.status='completed'
          AND r.publish_to_map=TRUE
          AND ST_Intersects(r.aoi,c.boundary)
        ORDER BY r.comparison_date DESC,r.name
        LIMIT 100
      ) v
      WHERE v.geom IS NOT NULL AND NOT ST_IsEmpty(v.geom)
    ),
    river_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',r.id,'geometry',ST_AsGeoJSON(r.geom)::jsonb,
            'properties',jsonb_build_object(
              'id',r.id,'entityType','river','name',r.name,'stressIndicator',r.stress_indicator
            )
          ) ORDER BY r.name
        ),'[]'::jsonb)
      ) features
      FROM (SELECT * FROM river_parts WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom) ORDER BY name LIMIT 500) r
    ),
    hazard_features AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features',COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature','id',h.id,'geometry',ST_AsGeoJSON(h.geom)::jsonb,
            'properties',jsonb_build_object(
              'id',h.id,'entityType','hazard_zone','name',h.name,'hazardType',h.hazard_type,
              'severity',h.severity,'source',h.source
            )
          ) ORDER BY
            CASE h.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
            h.name
        ),'[]'::jsonb)
      ) features
      FROM (SELECT * FROM hazard_parts WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom) LIMIT 500) h
    )
    SELECT
      c.id,c.catchment_code,c.name,c.catchment_level,c.parent_id,c.source,c.source_date,c.method,c.notes,
      round((ST_Area(c.boundary::geography)/1000000.0)::numeric,3) catchment_area_km2,
      ST_AsGeoJSON(c.boundary)::json boundary,
      ls.lga_count,ls.lgas,
      ss.settlements,ss.settlements_with_population,ss.known_population,
      bs.boreholes,bs.functional_boreholes,bs.boreholes_needing_attention,
      ast.assets,ast.functional_assets,ast.assets_needing_attention,
      fs.forest_sites,round(fs.forest_area_ha::numeric,2) forest_area_ha,
      rs.verified_rivers,round(rs.river_length_km::numeric,2) river_length_km,
      reps.open_reports,reps.critical_reports,reps.high_reports,
      hs.verified_hazard_zones,round(hs.hazard_area_km2::numeric,3) hazard_area_km2,hs.high_critical_hazards,
      vs.published_vegetation_analyses,vs.latest_vegetation_date,
      als.open_vegetation_alerts,
      pf.features settlements_geojson,
      bf.features boreholes_geojson,
      af.features assets_geojson,
      rf.features reports_geojson,
      ff.features forests_geojson,
      vf.features vegetation_geojson,
      rvf.features rivers_geojson,
      hf.features hazards_geojson
    FROM c
    CROSS JOIN lga_summary ls
    CROSS JOIN settlement_summary ss
    CROSS JOIN borehole_summary bs
    CROSS JOIN asset_summary ast
    CROSS JOIN forest_summary fs
    CROSS JOIN river_summary rs
    CROSS JOIN report_summary reps
    CROSS JOIN hazard_summary hs
    CROSS JOIN vegetation_summary vs
    CROSS JOIN alert_summary als
    CROSS JOIN point_features pf
    CROSS JOIN borehole_features bf
    CROSS JOIN asset_features af
    CROSS JOIN report_features rf
    CROSS JOIN forest_features ff
    CROSS JOIN vegetation_features vf
    CROSS JOIN river_features rvf
    CROSS JOIN hazard_features hf
  `,[catchmentId]);

  if(!result.rowCount)return error("Verified catchment not found.",404,"CATCHMENT_NOT_VERIFIED");
  const row=result.rows[0];

  return NextResponse.json({data:{
    catchment:{
      id:row.id,code:row.catchment_code,name:row.name,level:row.catchment_level,parentId:row.parent_id,
      source:row.source,sourceDate:row.source_date,method:row.method,notes:row.notes
    },
    catchmentAreaKm2:Number(row.catchment_area_km2||0),
    lgaCount:Number(row.lga_count||0),
    lgas:row.lgas,
    settlements:Number(row.settlements||0),
    settlementsWithPopulation:Number(row.settlements_with_population||0),
    knownPopulation:Number(row.known_population||0),
    boreholes:Number(row.boreholes||0),
    functionalBoreholes:Number(row.functional_boreholes||0),
    boreholesNeedingAttention:Number(row.boreholes_needing_attention||0),
    assets:Number(row.assets||0),
    functionalAssets:Number(row.functional_assets||0),
    assetsNeedingAttention:Number(row.assets_needing_attention||0),
    forestSites:Number(row.forest_sites||0),
    forestAreaHa:Number(row.forest_area_ha||0),
    verifiedRivers:Number(row.verified_rivers||0),
    riverLengthKm:Number(row.river_length_km||0),
    openReports:Number(row.open_reports||0),
    criticalReports:Number(row.critical_reports||0),
    highReports:Number(row.high_reports||0),
    verifiedHazardZones:Number(row.verified_hazard_zones||0),
    hazardAreaKm2:Number(row.hazard_area_km2||0),
    highCriticalHazards:Number(row.high_critical_hazards||0),
    publishedVegetationAnalyses:Number(row.published_vegetation_analyses||0),
    latestVegetationDate:row.latest_vegetation_date,
    openVegetationAlerts:Number(row.open_vegetation_alerts||0),
    boundary:row.boundary,
    layers:{
      settlements:row.settlements_geojson,
      boreholes:row.boreholes_geojson,
      assets:row.assets_geojson,
      reports:row.reports_geojson,
      forests:row.forests_geojson,
      vegetation:row.vegetation_geojson,
      rivers:row.rivers_geojson,
      hazards:row.hazards_geojson
    }
  },
  methodology:{
    measure:"verified_catchment_landscape_summary",
    note:"Counts and spatial summaries are calculated against the selected verified catchment polygon. Forest and hazard areas are unioned before area calculation to avoid overlap double-counting. Published vegetation analyses are counted but their change hectares are not summed because analyses may overlap and represent different dates or thresholds."
  }});
}
