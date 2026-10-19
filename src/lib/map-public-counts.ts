import {query} from "@/lib/db";

export const PUBLIC_MAP_CATEGORIES=["borehole","asset","forest_site","river","ndvi_change"] as const;
export type PublicMapCategory=typeof PUBLIC_MAP_CATEGORIES[number];
export type PublicMapCounts=Record<PublicMapCategory,number>;
export type MapCountFilters={lga?:string|null;status?:string|null};

/**
 * Counts are for the entire current state dataset, NOT the visible viewport.
 * They mirror the existing public map's publication rules exactly:
 * four mapped resource kinds plus quality-approved published NDVI analyses.
 * NDVI is separately counted; it is not physical intervention inventory.
 */
export const PUBLIC_MAP_COUNTS_SQL=`
 SELECT 'borehole' kind,count(*)::int total FROM boreholes
 WHERE ($1::text IS NULL OR lga_code=$1) AND ($2::text IS NULL OR status=$2)
 UNION ALL
 SELECT 'asset',count(*)::int FROM assets
 WHERE ($1::text IS NULL OR lga_code=$1) AND ($2::text IS NULL OR status=$2)
 UNION ALL
 SELECT 'forest_site',count(*)::int FROM forest_sites
 WHERE ($1::text IS NULL OR lga_code=$1) AND ($2::text IS NULL OR status=$2)
 UNION ALL
 SELECT 'river',count(*)::int FROM rivers
 WHERE verified=TRUE AND ($1::text IS NULL OR lga_code=$1)
 AND ($2::text IS NULL OR stress_indicator=$2)
 UNION ALL
 SELECT 'ndvi_change',count(*)::int FROM remote_sensing_analyses r
 WHERE $2::text IS NULL
 AND r.status='completed' AND r.publish_to_map=TRUE
 AND r.baseline_clear_fraction>=r.minimum_clear_fraction
 AND r.comparison_clear_fraction>=r.minimum_clear_fraction
 AND r.baseline_vegetation_ha IS NOT NULL AND r.comparison_vegetation_ha IS NOT NULL
 AND ($1::text IS NULL OR EXISTS(
   SELECT 1 FROM lgas lg
   WHERE lg.code=$1 AND lg.boundary IS NOT NULL
   AND ST_Intersects(r.aoi,lg.boundary)
 ))
`;

export function emptyPublicMapCounts():PublicMapCounts{
  return {borehole:0,asset:0,forest_site:0,river:0,ndvi_change:0};
}

export function summarizePublicMapCounts(rows:{kind:string;total:unknown}[]){
  const counts=emptyPublicMapCounts();
  for(const row of rows){
    if(!PUBLIC_MAP_CATEGORIES.includes(row.kind as PublicMapCategory))continue;
    const count=Number(row.total);
    if(Number.isSafeInteger(count)&&count>=0)counts[row.kind as PublicMapCategory]=count;
  }
  return {
    counts,
    physicalTotal:counts.borehole+counts.asset+counts.forest_site+counts.river,
    satelliteTotal:counts.ndvi_change
  };
}
export async function publicMapCounts(filters:MapCountFilters={}){
  const lga=filters.lga||null;
  const status=filters.status||null;
  const result=await query<{kind:string;total:number}>(PUBLIC_MAP_COUNTS_SQL,[lga,status]);
  return summarizePublicMapCounts(result.rows);
}
