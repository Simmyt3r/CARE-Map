import {query} from "@/lib/db";
import {deploymentProfile} from "@/lib/deployment-profile";

export type NamedLga={
  code:string;name:string;overlapHa:number|null;coveragePct:number|null;
  boundarySource:string|null;
};
export type NearbyCommunity={
  id:string;name:string;lgaCode:string;distanceM:number;inside:boolean;
  verified:boolean;source:string|null;
};
export type MappedAsset={
  id:string;kind:string;name:string;lgaCode:string;status:string|null;
  distanceM:number;inside:boolean;locationReviewed?:boolean;
};
export type SpatialContext={
  scope:"area"|"point";state:string|null;stateBasis:string;
  lgas:NamedLga[];communities:NearbyCommunity[];assets:MappedAsset[];
  assetCount:number;assetListTruncated:boolean;
  communityMatch:"mapped_point_inside"|"nearby_point_only"|"not_found";
  warnings:string[];
};
export function parsePoint(latitude:unknown,longitude:unknown){
  if(latitude==null||longitude==null||String(latitude).trim()===""||String(longitude).trim()==="")
    throw new Error("Both latitude and longitude are required.");
  const lat=Number(latitude),lng=Number(longitude);
  if(!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lng)||lng< -180||lng>180)
    throw new Error("Coordinates must be valid WGS84 latitude (-90 to 90) and longitude (-180 to 180).");
  if(lat===0&&lng===0)throw new Error("Coordinates at 0,0 are not a valid CARE-Map field position.");
  return {type:"Point" as const,coordinates:[lng,lat]};
}
export function informativeLocationText(context:SpatialContext){
  const names=context.lgas.map(l=>l.name);
  const lga=names.length===1?names[0]+" LGA":names.length>1?names.join(", ")+" LGAs":"LGA not matched";
  return [lga,context.state?context.state+" State":"state not established"].join(", ");
}
function numeric(v:unknown){return Number(v)||0;}

/**
 * The state label is justified only by an intersection with a stored, reviewable
 * LGA boundary. Mapped settlement POINTS do not define community boundaries.
 * Database query rows are selected explicitly, never including private contacts.
 */
export async function resolveSpatialContext(geometry:{type:string;coordinates:unknown},radiusM=2500):Promise<SpatialContext>{
  const scope=geometry.type==="Point"?"point":"area";
  const radius=Math.max(0,Math.min(5000,Math.round(radiusM)));
  const serialized=JSON.stringify(geometry);
  if(serialized.length>60000)throw new Error("Location geometry is too large for contextual lookup.");
  const geomSql="ST_SetSRID(ST_GeomFromGeoJSON($1::text),4326)";
  const base=`WITH target AS (SELECT ${geomSql} geom)`;
  const lgaResult=await query<{
    code:string;name:string;overlap_ha:number|null;coverage_pct:number|null;boundary_source:string|null
  }>(`${base}
    SELECT l.code,l.name,l.boundary_source,
      CASE WHEN $2='point' THEN NULL
        ELSE round((ST_Area(ST_Intersection(l.boundary,t.geom)::geography)/10000)::numeric,2) END overlap_ha,
      CASE WHEN $2='point' THEN NULL
        ELSE round((100*ST_Area(ST_Intersection(l.boundary,t.geom)::geography)/
          NULLIF(ST_Area(t.geom::geography),0))::numeric,1) END coverage_pct
    FROM lgas l CROSS JOIN target t
    WHERE l.boundary IS NOT NULL AND l.boundary && t.geom
      AND (CASE WHEN $2='point' THEN ST_Covers(l.boundary,t.geom)
        ELSE ST_Intersects(l.boundary,t.geom) AND NOT ST_Touches(l.boundary,t.geom) END)
    ORDER BY overlap_ha DESC NULLS LAST,l.name LIMIT 30`,[serialized,scope]);
  const lgas=lgaResult.rows.map(r=>({
    code:r.code,name:r.name,overlapHa:r.overlap_ha===null?null:numeric(r.overlap_ha),
    coveragePct:r.coverage_pct===null?null:numeric(r.coverage_pct),
    boundarySource:r.boundary_source
  }));
  const lgaCodes=lgas.map(l=>l.code);
  const communityResult=await query<{
    id:string;name:string;lga_code:string;distance_m:number;inside:boolean;verified:boolean;source:string|null
  }>(`${base}
    SELECT s.id,s.name,s.lga_code,s.verified,s.source,
      round(ST_Distance(s.location::geography,t.geom::geography)::numeric,0) distance_m,
      ST_Covers(t.geom,s.location) inside
    FROM settlements s CROSS JOIN target t
    WHERE ST_DWithin(s.location::geography,t.geom::geography,$2)
      AND (cardinality($3::text[])=0 OR s.lga_code=ANY($3::text[]))
    ORDER BY inside DESC,s.verified DESC,distance_m ASC,s.name ASC LIMIT 8`,
    [serialized,radius,lgaCodes]);
  const communities=communityResult.rows.map(r=>({
    id:r.id,name:r.name,lgaCode:r.lga_code,distanceM:numeric(r.distance_m),
    inside:Boolean(r.inside),verified:Boolean(r.verified),source:r.source
  }));

  // The inventory is bounded for low-connection Aiven tiers. No private
  // community contact/field officer data or open reports appear here.
  const assetResult=await query<{
    id:string;kind:string;name:string;lga_code:string;status:string|null;
    distance_m:number;inside:boolean;location_reviewed:boolean|null
  }>(`${base},
    candidates AS (
      SELECT id,'borehole'::text kind,name,lga_code,status,
        location geom,NULL::boolean location_reviewed FROM boreholes
      UNION ALL
      SELECT id,'asset',name,lga_code,status,location,NULL::boolean FROM assets
      UNION ALL
      SELECT id,'forest_site',name,lga_code,status,boundary,NULL::boolean FROM forest_sites
      UNION ALL
      SELECT id,'river',COALESCE(name,local_name,'Unnamed river'),lga_code,
        stress_indicator,course,NULL::boolean FROM rivers WHERE verified=TRUE
      UNION ALL
      SELECT id,'community_intervention',project_name,lga_code,project_status,
        location,(location_review='verified') FROM community_interventions
    )
    SELECT c.id,c.kind,c.name,c.lga_code,c.status,c.location_reviewed,
      round(ST_Distance(c.geom::geography,t.geom::geography)::numeric,0) distance_m,
      ST_Intersects(c.geom,t.geom) inside
    FROM candidates c CROSS JOIN target t
    WHERE c.geom && ST_Expand(t.geom,0.05)
      AND (CASE WHEN $2='point'
        THEN ST_DWithin(c.geom::geography,t.geom::geography,$3)
        ELSE ST_Intersects(c.geom,t.geom) END)
    ORDER BY inside DESC,distance_m ASC,c.kind,c.name LIMIT 51`,
    [serialized,scope,radius]);
  const assets=assetResult.rows.slice(0,50).map(r=>({
    id:r.id,kind:r.kind,name:r.name,lgaCode:r.lga_code,status:r.status,
    distanceM:numeric(r.distance_m),inside:Boolean(r.inside),
    ...(r.location_reviewed===null?{}:{locationReviewed:Boolean(r.location_reviewed)})
  }));
  const warnings:string[]=[];
  if(!lgas.length)warnings.push("No stored LGA polygon overlaps this location; state and LGA are not confirmed.");
  if(lgas.length>1)warnings.push("AOI crosses LGA boundaries. The reported NDVI change belongs to the whole AOI, not separately to each LGA.");
  if(!communities.length)warnings.push("No named settlement point in the database within the search distance.");
  if(communities.length&&!communities.some(c=>c.verified))
    warnings.push("Nearby settlement names are unverified mapped points, not confirmed community boundaries.");
  if(!assets.length)warnings.push("No mapped assets matched. This does not prove no infrastructure exists on the ground.");
  const communityMatch:SpatialContext["communityMatch"]=communities.some(c=>c.inside)
    ?"mapped_point_inside":communities.length?"nearby_point_only":"not_found";
  return{
    scope,state:lgas.length?deploymentProfile.stateName:null,
    stateBasis:lgas.length?"stored_lga_boundary":"unconfirmed",
    lgas,communities,assets,assetCount:assetResult.rows.length,
    assetListTruncated:assetResult.rows.length>50,communityMatch,warnings
  };
}
