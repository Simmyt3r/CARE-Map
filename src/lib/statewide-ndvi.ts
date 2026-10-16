import {query} from "@/lib/db";
import {deploymentProfile} from "@/lib/deployment-profile";
import {comparisonWindowError,observationDate} from "@/lib/sentinel-date-quality";
import {
  assessNdviQuality,fetchNdviStats,NoSentinelObservationError,remoteSensingConfigured,
  searchSentinelScenes,isSentinelProviderLimit,type GeoPolygon
} from "@/lib/remote-sensing";

export const TILE_DEGREES=0.10;
export const MAX_STATE_TILES=1600;
export const MIN_CLEAR_FRACTION=0.60;

type PlanOverview={total_lgas:number;mapped_lgas:number;unmapped_lgas:number;
  sum_area_ha:number;union_area_ha:number};
export type StatewideOptions={
  baselineDate:string;comparisonDate:string;windowDays:number;threshold:number;
};
export function validateStatewideOptions(x:StatewideOptions){
  if(!Number.isInteger(x.windowDays)||x.windowDays<1||x.windowDays>30)
    throw new Error("Observation window must be between 1 and 30 days.");
  if(!Number.isFinite(x.threshold)||x.threshold< -1||x.threshold>1)
    throw new Error("NDVI threshold must be between -1 and 1.");
  const issue=comparisonWindowError(x.baselineDate,x.comparisonDate,x.windowDays);
  if(issue)throw new Error(issue);
}
export async function stateBoundaryReadiness(){
  const result=await query<PlanOverview>(`
    SELECT count(*)::int AS total_lgas,
      count(*) FILTER (WHERE boundary IS NOT NULL)::int mapped_lgas,
      count(*) FILTER (WHERE boundary IS NULL)::int unmapped_lgas,
      COALESCE(sum(ST_Area(boundary::geography))/10000.0,0) AS sum_area_ha,
      COALESCE(ST_Area(ST_UnaryUnion(ST_Collect(boundary))::geography)/10000.0,0) AS union_area_ha
    FROM lgas`);
  const x=result.rows[0];
  const union=Number(x.union_area_ha),sum=Number(x.sum_area_ha);
  return{
    totalLgas:Number(x.total_lgas),mappedLgas:Number(x.mapped_lgas),
    unmappedLgas:Number(x.unmapped_lgas),boundaryAreaHa:union,
    overlapFraction:union>0?Math.max(0,(sum-union)/union):0
  };
}

export async function planStatewideJob(x:StatewideOptions,actorId:string){
  validateStatewideOptions(x);
  if(!remoteSensingConfigured())throw new Error("Copernicus credentials must be configured before starting state-wide processing.");
  const ready=await stateBoundaryReadiness();
  if(!ready.totalLgas||ready.unmappedLgas)
    throw new Error("State-wide analysis requires reviewed boundary geometries for every LGA. Missing: "+ready.unmappedLgas+".");
  if(ready.overlapFraction>0.002)
    throw new Error("Imported LGA polygons overlap by more than 0.2% of the mapped state. Correct the boundaries to avoid double-counted vegetation.");
  const existing=await query<{id:string}>(
    "SELECT id FROM statewide_ndvi_jobs WHERE status IN ('queued','running') LIMIT 1");
  if(existing.rows.length)
    throw new Error("Another state-wide analysis is already active. Resume or complete it before creating a new job.");

  // This is an explicit new job and does not modify the older per-AOI analyses.
  const result=await query<{id:string}>(`
    INSERT INTO statewide_ndvi_jobs(
      state_name,baseline_date,comparison_date,window_days,vegetation_threshold,
      expected_lgas,source_note,created_by
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [deploymentProfile.stateName,x.baselineDate,x.comparisonDate,x.windowDays,
      x.threshold,ready.totalLgas,
      "Coverage of imported LGA polygons. Quality-reviewed tiles only; not an authoritative surveyed state boundary.",
      actorId]);
  const id=result.rows[0].id;
  try{
    // Grid tiles clip exactly to each LGA, rather than using a bounding box
    // that introduces areas outside the configured state.
    const inserted=await query<{count:string}>(`
      WITH grids AS (
        SELECT l.code,gs_x AS gx,gs_y AS gy,
          l.boundary,
          ST_MakeEnvelope(gs_x*$2,gs_y*$2,(gs_x+1)*$2,(gs_y+1)*$2,4326) cell
        FROM lgas l
        CROSS JOIN LATERAL generate_series(
          floor(ST_XMin(l.boundary)/$2)::int,
          ceil(ST_XMax(l.boundary)/$2)::int-1
        ) gs_x
        CROSS JOIN LATERAL generate_series(
          floor(ST_YMin(l.boundary)/$2)::int,
          ceil(ST_YMax(l.boundary)/$2)::int-1
        ) gs_y
        WHERE l.boundary IS NOT NULL
      ),
      clipped AS (
        SELECT code,gx,gy,
          ST_Multi(ST_CollectionExtract(
            ST_Intersection(ST_MakeValid(boundary),cell),3
          ))::geometry(MultiPolygon,4326) geom
        FROM grids WHERE ST_Intersects(boundary,cell)
      ),
      created AS (
        INSERT INTO statewide_ndvi_tiles(job_id,lga_code,grid_x,grid_y,aoi,area_ha)
        SELECT $1::uuid,code,gx,gy,geom,ST_Area(geom::geography)/10000.0
        FROM clipped WHERE NOT ST_IsEmpty(geom)
          AND ST_Area(geom::geography)>100
        RETURNING id
      ) SELECT count(*)::text count FROM created
    `,[id,TILE_DEGREES]);
    const total=Number(inserted.rows[0].count);
    if(!total||total>MAX_STATE_TILES){
      await query("DELETE FROM statewide_ndvi_jobs WHERE id=$1",[id]);
      throw new Error("State boundaries produced "+total+" tiles; expected 1 to "+MAX_STATE_TILES+
        ". Inspect/simplify the imported LGA geometry before starting.");
    }
    await query("UPDATE statewide_ndvi_jobs SET total_tiles=$2,updated_at=now() WHERE id=$1",[id,total]);
    await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create','statewide_ndvi_job',$2,$3)",
      [actorId,id,JSON.stringify({total,state:deploymentProfile.stateName,baselineDate:x.baselineDate,comparisonDate:x.comparisonDate})]);
    return {id,totalTiles:total,lgas:ready.totalLgas,state:deploymentProfile.stateName};
  }catch(e){
    await query("DELETE FROM statewide_ndvi_jobs WHERE id=$1",[id]).catch(()=>{});
    throw e;
  }
}

export async function statewideOverview(){
  const rows=await query<{
    id:string;status:string;quota_blocked_tiles:number;
    total_tiles:number;completed_tiles:number;
    total_area_ha:number|string;completed_area_ha:number|string;
    baseline_ha:number|string;comparison_ha:number|string;
  }>(`
    SELECT j.id,j.state_name,j.status,j.baseline_date,j.comparison_date,
      j.window_days,j.vegetation_threshold,j.total_tiles,j.expected_lgas,
      j.created_at,j.finished_at,
      count(t.id)::int AS queued_total,
      count(t.id) FILTER (WHERE t.status='completed')::int AS completed_tiles,
      count(t.id) FILTER (WHERE t.status='needs_review')::int AS needs_review_tiles,
      count(t.id) FILTER (WHERE t.status='failed')::int AS failed_tiles,
      count(t.id) FILTER (WHERE t.status='failed'
        AND t.quality_notes ~* 'rate.?limit|quota|too many requests|processing units')::int
        AS quota_blocked_tiles,
      count(t.id) FILTER (WHERE t.status IN ('queued','running'))::int AS pending_tiles,
      COALESCE(sum(t.area_ha),0) AS total_area_ha,
      COALESCE(sum(t.area_ha) FILTER (WHERE t.status='completed'),0) AS completed_area_ha,
      COALESCE(sum(t.baseline_vegetation_ha) FILTER (WHERE t.status='completed'),0) AS baseline_ha,
      COALESCE(sum(t.comparison_vegetation_ha) FILTER (WHERE t.status='completed'),0) AS comparison_ha
    FROM statewide_ndvi_jobs j
    LEFT JOIN statewide_ndvi_tiles t ON t.job_id=j.id
    GROUP BY j.id
    ORDER BY j.created_at DESC LIMIT 10`);
  return rows.rows.map(r=>{
    const complete=Number(r.completed_tiles)===Number(r.total_tiles)&&Number(r.total_tiles)>0;
    const baseline=Number(r.baseline_ha),comparison=Number(r.comparison_ha);
    return {id:String(r.id),...r,
      coveragePercent:Number(r.total_area_ha)>0
        ?100*Number(r.completed_area_ha)/Number(r.total_area_ha):0,
      estimatedChangeHa:complete?comparison-baseline:null,
      estimatedChangePct:complete&&baseline>0?100*(comparison-baseline)/baseline:null,
      resultsComplete:complete,
      status:r.status
    };
  });
}

export async function statewideLgaSummary(jobId:string){
  const rows=await query(`
    SELECT l.code,l.name,
      count(t.id)::int AS total_tiles,
      count(t.id) FILTER (WHERE t.status='completed')::int AS completed_tiles,
      count(t.id) FILTER (WHERE t.status='needs_review')::int AS needs_review_tiles,
      count(t.id) FILTER (WHERE t.status='failed')::int AS failed_tiles,
      sum(t.area_ha) AS area_ha,
      COALESCE(sum(t.area_ha) FILTER (WHERE t.status='completed'),0) AS completed_area_ha,
      sum(t.baseline_vegetation_ha) FILTER (WHERE t.status='completed') AS baseline_ha,
      sum(t.comparison_vegetation_ha) FILTER (WHERE t.status='completed') AS comparison_ha
    FROM lgas l JOIN statewide_ndvi_tiles t ON t.lga_code=l.code AND t.job_id=$1
    GROUP BY l.code,l.name ORDER BY l.name`,[jobId]);
  return rows.rows.map(r=>{
    const complete=Number(r.total_tiles)>0&&Number(r.completed_tiles)===Number(r.total_tiles);
    const baseline=Number(r.baseline_ha),comparison=Number(r.comparison_ha);
    return {...r,complete,
      coveragePercent:Number(r.area_ha)>0?100*Number(r.completed_area_ha)/Number(r.area_ha):0,
      changeHa:complete?comparison-baseline:null,
      changePct:complete&&baseline>0?100*(comparison-baseline)/baseline:null
    };
  });
}

type TileClaim={
  id:string;job_id:string;lga_code:string;aoi_geometry:GeoPolygon;
  area_ha:number|string;baseline_date:string;comparison_date:string;
  window_days:number;vegetation_threshold:number|string;minimum_clear_fraction:number|string
};
export async function runNextStatewideTile(jobId:string){
  if(!remoteSensingConfigured())throw new Error("Copernicus credentials are not configured.");
  const result=await query<TileClaim>(`
    WITH claim AS (
      SELECT t.id FROM statewide_ndvi_tiles t
      JOIN statewide_ndvi_jobs j ON j.id=t.job_id
      WHERE j.id=$1 AND j.status IN ('queued','running')
        AND (t.status='queued' OR
          (t.status='running' AND t.claimed_at<now()-INTERVAL '5 minutes') OR
          (t.status='failed' AND t.attempts<2))
      ORDER BY t.attempts,t.id LIMIT 1 FOR UPDATE OF t SKIP LOCKED
    ), updated AS (
      UPDATE statewide_ndvi_tiles t
        SET status='running',claimed_at=now(),attempts=t.attempts+1
      FROM claim WHERE t.id=claim.id
      RETURNING t.*
    )
    SELECT t.id::text,t.job_id::text,t.lga_code,
      ST_AsGeoJSON(t.aoi)::json aoi_geometry,t.area_ha,
      j.baseline_date,j.comparison_date,j.window_days,j.vegetation_threshold,
      j.minimum_clear_fraction
    FROM updated t JOIN statewide_ndvi_jobs j ON j.id=t.job_id
  `,[jobId]);
  const tile=result.rows[0];
  if(!tile){
    await finishStatewideJob(jobId);
    return {processed:false};
  }
  await query("UPDATE statewide_ndvi_jobs SET status='running',updated_at=now() WHERE id=$1",[jobId]);
  let status="completed",notes="",providerBlocked=false;
  let baseline:null|Awaited<ReturnType<typeof fetchNdviStats>>=null;
  let comparison:null|Awaited<ReturnType<typeof fetchNdviStats>>=null;
  try{
    const baselineDate=observationDate(tile.baseline_date);
    const comparisonDate=observationDate(tile.comparison_date);
    const opts=Number(tile.window_days),areaHa=Number(tile.area_ha),threshold=Number(tile.vegetation_threshold);
    // Run statistics sequentially. If the first provider call hits a quota,
    // do not spend three further requests on the same tile.
    const b=await fetchNdviStats(tile.aoi_geometry,baselineDate,opts,threshold,areaHa);
    baseline=b;
    const c=await fetchNdviStats(tile.aoi_geometry,comparisonDate,opts,threshold,areaHa);
    comparison=c;
    const quality=assessNdviQuality(b,c,Number(tile.minimum_clear_fraction));
    // STAC is a discovery cross-check. An outage must not discard valid
    // Copernicus statistics or trigger a broad retry storm.
    const scenes=await Promise.allSettled([
      searchSentinelScenes(tile.aoi_geometry,baselineDate,opts,70),
      searchSentinelScenes(tile.aoi_geometry,comparisonDate,opts,70)
    ]);
    if(scenes[0].status==="fulfilled"&&!scenes[0].value.length)
      quality.issues.push("No baseline catalogue scenes.");
    if(scenes[1].status==="fulfilled"&&!scenes[1].value.length)
      quality.issues.push("No comparison catalogue scenes.");
    if(scenes.some(x=>x.status==="rejected"))
      quality.issues.push("Sentinel scene catalogue unavailable; verify scene provenance before accepting this tile.");
    if(quality.issues.length){status="needs_review";notes=quality.issues.join(" ");}
  }catch(e){
    if(isSentinelProviderLimit(e)){
      // A hard provider cap is a job-wide problem, not 490 individual bad scenes.
      providerBlocked=true;
      status="failed";
      notes="Copernicus provider rate limit reached. Processing halted. Confirm account quota before an administrator requeues provider-limited tiles.";
    }else if(e instanceof NoSentinelObservationError){
      status="needs_review";notes=e.message;
    }else{
      status="failed";notes=e instanceof Error?e.message:"Sentinel request failed.";
    }
  }
  await query(`
    UPDATE statewide_ndvi_tiles SET status=$2,quality_notes=$3,
      baseline_clear_fraction=$4,comparison_clear_fraction=$5,
      baseline_mean_ndvi=$6,comparison_mean_ndvi=$7,
      baseline_vegetation_ha=$8,comparison_vegetation_ha=$9,
      completed_at=now()
    WHERE id=$1`,[
      tile.id,status,notes.slice(0,1300),baseline?.clearFraction??null,comparison?.clearFraction??null,
      baseline?.meanNdvi??null,comparison?.meanNdvi??null,
      baseline?.vegetationHa??null,comparison?.vegetationHa??null
    ]);
  if(providerBlocked){
    await query(`
      UPDATE statewide_ndvi_jobs
      SET status='needs_review',finished_at=now(),updated_at=now()
      WHERE id=$1 AND status IN ('queued','running')`,[jobId]);
    return {processed:true,tileId:tile.id,lgaCode:tile.lga_code,status,
      providerBlocked:true,qualityNotes:notes};
  }
  await finishStatewideJob(jobId);
  return {processed:true,tileId:tile.id,lgaCode:tile.lga_code,status,
    providerBlocked:false,qualityNotes:notes||null};
}

/** Admin-controlled recovery of ONLY provider-limited failures.
 * No approved NDVI observations or cloud-quality review cases are reset.
 * One SQL statement ensures job reactivation and selective requeue are atomic.
 */
export async function requeueProviderLimitedTiles(jobId:string){
  const result=await query<{id:string;requeued:number}>(`
    WITH activate AS (
      UPDATE statewide_ndvi_jobs j
      SET status='queued',finished_at=NULL,updated_at=now()
      WHERE j.id=$1 AND j.status='needs_review'
        AND NOT EXISTS(
          SELECT 1 FROM statewide_ndvi_jobs other
          WHERE other.id<>j.id AND other.status IN ('queued','running')
        )
        AND EXISTS (
          SELECT 1 FROM statewide_ndvi_tiles t
          WHERE t.job_id=j.id AND t.status='failed'
            AND t.quality_notes ~* 'rate.?limit|quota|too many requests|processing units'
        )
      RETURNING id
    ), retries AS (
      UPDATE statewide_ndvi_tiles t
      SET status='queued',attempts=0,claimed_at=NULL,completed_at=NULL,
        quality_notes='Administrator requeued after provider quota review'
      WHERE t.job_id IN (SELECT id FROM activate) AND t.status='failed'
        AND t.quality_notes ~* 'rate.?limit|quota|too many requests|processing units'
      RETURNING id
    )
    SELECT a.id::text,COUNT(r.id)::int requeued
    FROM activate a LEFT JOIN retries r ON true GROUP BY a.id`,[jobId]);
  if(!result.rows.length)throw new Error(
    "No provider-limited tiles are eligible for recovery, or another state-wide job is active.");
  return {jobId:result.rows[0].id,requeued:Number(result.rows[0].requeued)};
}

export async function finishStatewideJob(jobId:string){
  const result=await query<{pending:number;review:number}>(`
    SELECT
      count(*) FILTER (WHERE status='queued' OR status='running'
        OR (status='failed' AND attempts<2))::int pending,
      count(*) FILTER (WHERE status<>'completed')::int review
    FROM statewide_ndvi_tiles WHERE job_id=$1`,[jobId]);
  const counts=result.rows[0];
  if(Number(counts.pending)===0){
    const status=Number(counts.review)>0?"needs_review":"completed";
    await query(`
      UPDATE statewide_ndvi_jobs SET status=$2,updated_at=now(),finished_at=now()
      WHERE id=$1 AND status IN ('queued','running')`,[jobId,status]);
  }
}
