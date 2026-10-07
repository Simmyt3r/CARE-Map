import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {
  classifySettlementAccess,
  parseSettlementAccessRadius,
  settlementNearestSearchRadius
} from "@/lib/settlements";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type AccessRow={
  id:string;
  settlement_code:string|null;
  name:string;
  settlement_type:string;
  lga_code:string;
  population:number|null;
  population_year:number|null;
  population_source:string|null;
  source:string;
  verified:boolean;
  latitude:number;
  longitude:number;
  nearest_borehole_id:string|null;
  nearest_borehole_name:string|null;
  nearest_distance_m:number|null;
  nearest_latitude:number|null;
  nearest_longitude:number|null;
  total_available:number;
};

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=String(url.searchParams.get("lga")||"").trim().toUpperCase();
  const thresholdM=parseSettlementAccessRadius(url.searchParams.get("radius")||"2000");
  const includeUnverified=url.searchParams.get("includeUnverified")==="1";

  if(!lga)return error("LGA code is required.");
  if(thresholdM==null)return error("Access threshold must be between 100 m and 50 km.");

  const searchRadiusM=settlementNearestSearchRadius(thresholdM);

  const [lgaResult,settlementResult]=await Promise.all([
    query(`
      SELECT code,name,boundary_source,
             CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END boundary
      FROM lgas
      WHERE code=$1
    `,[lga]),
    query<AccessRow>(`
      SELECT
        s.id,s.settlement_code,s.name,s.settlement_type,s.lga_code,
        s.population,s.population_year,s.population_source,s.source,s.verified,
        ST_Y(s.location) latitude,ST_X(s.location) longitude,
        nb.id nearest_borehole_id,nb.name nearest_borehole_name,
        nb.distance_m nearest_distance_m,
        nb.latitude nearest_latitude,nb.longitude nearest_longitude,
        count(*) OVER()::int total_available
      FROM settlements s
      LEFT JOIN LATERAL (
        SELECT
          b.id,b.name,
          ST_Distance(b.location::geography,s.location::geography) distance_m,
          ST_Y(b.location) latitude,
          ST_X(b.location) longitude
        FROM boreholes b
        WHERE b.status='functional'
          AND ST_DWithin(b.location::geography,s.location::geography,$3)
        ORDER BY ST_Distance(b.location::geography,s.location::geography)
        LIMIT 1
      ) nb ON TRUE
      WHERE s.lga_code=$1
        AND ($2::boolean OR s.verified=TRUE)
      ORDER BY s.name
      LIMIT 10000
    `,[lga,includeUnverified,searchRadiusM])
  ]);

  if(!lgaResult.rowCount)return error("LGA not found.",404);
  const totalAvailable=Number(settlementResult.rows[0]?.total_available||0);
  if(totalAvailable>10000){
    return error("This LGA has more than 10,000 matching settlements. Narrow the dataset before analysis.",413,"ANALYSIS_LIMIT");
  }

  const assessed=settlementResult.rows.map(row=>{
    const distance=row.nearest_distance_m==null?null:Number(row.nearest_distance_m);
    const accessClass=classifySettlementAccess(distance,thresholdM);
    return {...row,nearest_distance_m:distance,access_class:accessClass};
  });

  const within=assessed.filter(x=>x.access_class==="within_threshold");
  const gaps=assessed.filter(x=>x.access_class!=="within_threshold");
  const beyondSearch=gaps.filter(x=>x.access_class==="beyond_search_radius");

  const populationRows=assessed.filter(x=>x.population!=null);
  const populationTotal=populationRows.reduce((sum,x)=>sum+Number(x.population||0),0);
  const populationWithin=populationRows
    .filter(x=>x.access_class==="within_threshold")
    .reduce((sum,x)=>sum+Number(x.population||0),0);
  const populationGap=populationTotal-populationWithin;

  const uniqueBoreholes=new Map<string,any>();
  for(const row of assessed){
    if(!row.nearest_borehole_id||row.nearest_latitude==null||row.nearest_longitude==null)continue;
    uniqueBoreholes.set(row.nearest_borehole_id,{
      type:"Feature",
      id:row.nearest_borehole_id,
      geometry:{type:"Point",coordinates:[Number(row.nearest_longitude),Number(row.nearest_latitude)]},
      properties:{id:row.nearest_borehole_id,name:row.nearest_borehole_name,status:"functional"}
    });
  }

  const settlementFeatures=assessed.map(row=>({
    type:"Feature",
    id:row.id,
    geometry:{type:"Point",coordinates:[Number(row.longitude),Number(row.latitude)]},
    properties:{
      id:row.id,
      settlementCode:row.settlement_code,
      name:row.name,
      settlementType:row.settlement_type,
      lgaCode:row.lga_code,
      population:row.population,
      populationYear:row.population_year,
      populationSource:row.population_source,
      source:row.source,
      verified:row.verified,
      nearestBoreholeId:row.nearest_borehole_id,
      nearestBoreholeName:row.nearest_borehole_name,
      nearestDistanceM:row.nearest_distance_m,
      accessClass:row.access_class
    }
  }));

  const sortedGaps=[...gaps].sort((a,b)=>{
    if(a.nearest_distance_m==null&&b.nearest_distance_m!=null)return -1;
    if(a.nearest_distance_m!=null&&b.nearest_distance_m==null)return 1;
    if(a.nearest_distance_m!==b.nearest_distance_m){
      return Number(b.nearest_distance_m||0)-Number(a.nearest_distance_m||0);
    }
    return Number(b.population||0)-Number(a.population||0);
  });

  const gapFeatures=sortedGaps.slice(0,25).map((row,index)=>({
    type:"Feature",
    id:row.id,
    geometry:{type:"Point",coordinates:[Number(row.longitude),Number(row.latitude)]},
    properties:{
      rank:index+1,
      id:row.id,
      name:row.name,
      settlementType:row.settlement_type,
      population:row.population,
      populationYear:row.population_year,
      nearestBoreholeName:row.nearest_borehole_name,
      nearestDistanceM:row.nearest_distance_m,
      accessClass:row.access_class,
      latitude:Number(row.latitude),
      longitude:Number(row.longitude)
    }
  }));

  const lineFeatures=sortedGaps
    .filter(row=>row.nearest_borehole_id&&row.nearest_latitude!=null&&row.nearest_longitude!=null)
    .slice(0,100)
    .map(row=>({
      type:"Feature",
      geometry:{
        type:"LineString",
        coordinates:[
          [Number(row.longitude),Number(row.latitude)],
          [Number(row.nearest_longitude),Number(row.nearest_latitude)]
        ]
      },
      properties:{
        settlementId:row.id,
        settlementName:row.name,
        boreholeId:row.nearest_borehole_id,
        boreholeName:row.nearest_borehole_name,
        distanceM:row.nearest_distance_m
      }
    }));

  const lgaRow=lgaResult.rows[0] as any;
  const total=assessed.length;
  const populationKnownCount=populationRows.length;

  return NextResponse.json({
    data:{
      lga:{
        code:lgaRow.code,
        name:lgaRow.name,
        boundarySource:lgaRow.boundary_source,
        boundary:lgaRow.boundary
      },
      thresholdM,
      nearestSearchRadiusM:searchRadiusM,
      includeUnverified,
      summary:{
        totalSettlements:total,
        withinThreshold:within.length,
        accessGaps:gaps.length,
        beyondSearchRadius:beyondSearch.length,
        settlementAccessPct:total?Number(((within.length/total)*100).toFixed(2)):0,
        populationKnownSettlements:populationKnownCount,
        populationCompletenessPct:total?Number(((populationKnownCount/total)*100).toFixed(2)):0,
        knownPopulationTotal:populationTotal,
        knownPopulationWithin:populationWithin,
        knownPopulationGap:populationGap,
        knownPopulationAccessPct:populationTotal?Number(((populationWithin/populationTotal)*100).toFixed(2)):null
      },
      settlements:{type:"FeatureCollection",features:settlementFeatures},
      nearestBoreholes:{type:"FeatureCollection",features:[...uniqueBoreholes.values()]},
      gapLines:{type:"FeatureCollection",features:lineFeatures},
      gaps:{type:"FeatureCollection",features:gapFeatures}
    },
    methodology:{
      distance:"straight_line_geography",
      populationCoverageBasis:"known_population_records_only",
      note:"Settlement access is classified using straight-line distance to the nearest functional borehole found inside the documented search horizon. It does not model roads, paths, slope, bridges, queues, borehole capacity, water quality or actual household use."
    }
  });
}
