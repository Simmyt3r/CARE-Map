import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {Client} from "pg";
import fs from "node:fs";
import path from "node:path";
import {pool,query} from "../src/lib/db";
import {planStatewideJob,stateBoundaryReadiness,statewideLgaSummary,statewideOverview,requeueProviderLimitedTiles,claimStatewideProcessingSlot} from "../src/lib/statewide-ndvi";

const db=process.env.CAREMAP_PG_INTEGRATION_URL;
describe.skipIf(!db)("State-wide Sentinel spatial tiling with real PostGIS",()=>{
 const client=new Client({connectionString:db,ssl:false});
 const actor="00000000-0000-4000-8000-000000000099";
 beforeAll(async()=>{
  process.env.DATABASE_URL=db;
  process.env.CDSE_CLIENT_ID="ci-only";
  process.env.CDSE_CLIENT_SECRET="ci-only";
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await client.query(`
    CREATE TABLE users(id uuid primary key);
    CREATE TABLE lgas(code text primary key,name text,boundary geometry(Polygon,4326));
    CREATE TABLE audit_logs(actor_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb);
    INSERT INTO users VALUES ('00000000-0000-4000-8000-000000000099');
    INSERT INTO lgas(code,name,boundary) VALUES
    ('A','Test A',ST_GeomFromText('POLYGON((8.4 7.4,8.6 7.4,8.6 7.6,8.4 7.6,8.4 7.4))',4326)),
    ('B','Test B',ST_GeomFromText('POLYGON((8.6 7.4,8.8 7.4,8.8 7.6,8.6 7.6,8.6 7.4))',4326));
  `);
  const migration=fs.readFileSync(path.join(process.cwd(),"db/migrations/018_statewide_ndvi_batches.sql"),"utf8");
  await client.query(migration);
 },30000);
 afterAll(async()=>{
  await pool().end().catch(()=>{});
  await client.query("DROP TABLE IF EXISTS statewide_ndvi_tiles CASCADE").catch(()=>{});
  await client.query("DROP TABLE IF EXISTS statewide_ndvi_jobs CASCADE").catch(()=>{});
  for(const t of ["audit_logs","lgas","users"]){
    await client.query("DROP TABLE IF EXISTS "+t+" CASCADE").catch(()=>{});
  }
  await client.end().catch(()=>{});
 },30000);
 it("rejects double-counted boundary overlap and reports independent state coverage",async()=>{
  const ready=await stateBoundaryReadiness();
  expect(ready.totalLgas).toBe(2);
  expect(ready.mappedLgas).toBe(2);
  expect(ready.overlapFraction).toBeLessThan(0.002);
  expect(ready.boundaryAreaHa).toBeGreaterThan(1);
 });
 it("plans clipped tiles without analyzing outside boundaries, keeps incomplete rollups null",async()=>{
  const p=await planStatewideJob({
    baselineDate:"2025-01-15",comparisonDate:"2026-01-15",windowDays:14,threshold:0.3
  },actor);
  expect(p.totalTiles).toBeGreaterThan(1);
  expect(p.totalTiles).toBeLessThan(1600);
  const sizes=await query<{tile_area:number;boundary_area:number;tiles:number}>(`
    SELECT sum(ST_Area(t.aoi::geography)) tile_area,
       (SELECT sum(ST_Area(l.boundary::geography)) FROM lgas l) boundary_area,
       count(*)::int tiles
    FROM statewide_ndvi_tiles t WHERE t.job_id=$1`,[p.id]);
  expect(Number(sizes.rows[0].tiles)).toBe(p.totalTiles);
  expect(Number(sizes.rows[0].tile_area)/Number(sizes.rows[0].boundary_area)).toBeCloseTo(1,3);
  const initial=(await statewideOverview())[0];
  expect(initial.resultsComplete).toBe(false);
  expect(initial.estimatedChangeHa).toBeNull();
  await query(`
    UPDATE statewide_ndvi_tiles SET status='completed',baseline_vegetation_ha=25,
      comparison_vegetation_ha=35,baseline_clear_fraction=0.95,comparison_clear_fraction=0.95
    WHERE id=(SELECT min(id) FROM statewide_ndvi_tiles WHERE job_id=$1)`,[p.id]);
  const partial=(await statewideOverview())[0];
  expect(partial.resultsComplete).toBe(false);
  expect(partial.estimatedChangeHa).toBeNull();
  const lga=await statewideLgaSummary(p.id);
  expect(lga).toHaveLength(2);
  expect(lga.some(x=>!x.complete)).toBe(true);
  await query(`
    UPDATE statewide_ndvi_tiles SET status='completed',baseline_vegetation_ha=25,
      comparison_vegetation_ha=35,baseline_clear_fraction=0.9,comparison_clear_fraction=0.9
    WHERE job_id=$1`,[p.id]);
  const complete=(await statewideOverview())[0];
  expect(complete.resultsComplete).toBe(true);
  expect(Number(complete.estimatedChangeHa)).toBeCloseTo(10*p.totalTiles,6);
  expect(complete.coveragePercent).toBeCloseTo(100,6);
  const lgas=await statewideLgaSummary(p.id);
  expect(lgas.every(x=>x.complete)).toBe(true);
 },30000);
 it("requeues only provider-limited failures and preserves completed/low-clear tiles",async()=>{
  const job=(await statewideOverview())[0];
  const ids=await query<{id:number}>(
    "SELECT id FROM statewide_ndvi_tiles WHERE job_id=$1 ORDER BY id LIMIT 4",[job.id]);
  const [a,b,c,d]=ids.rows.map(r=>r.id);
  await query(`
    UPDATE statewide_ndvi_tiles SET
      status=CASE
        WHEN id=$2 OR id=$3 THEN 'failed'
        WHEN id=$4 THEN 'needs_review'
        ELSE status END,
      attempts=CASE WHEN id IN ($2,$3) THEN 2 ELSE attempts END,
      quality_notes=CASE WHEN id=$2 THEN 'You have exceeded your rate limit'
        WHEN id=$3 THEN 'Copernicus provider rate limit reached'
        WHEN id=$4 THEN 'Comparison clear-pixel coverage is below 60%'
        ELSE quality_notes END
    WHERE job_id=$1 AND id IN ($2,$3,$4)`,[job.id,a,b,c]);
  await query("UPDATE statewide_ndvi_jobs SET status='needs_review' WHERE id=$1",[job.id]);
  const recovered=await requeueProviderLimitedTiles(job.id);
  expect(recovered.requeued).toBe(2);
  const data=await query<{id:number;status:string;attempts:number;quality_notes:string|null}>(`
    SELECT id,status,attempts,quality_notes FROM statewide_ndvi_tiles
    WHERE job_id=$1 AND id IN ($2,$3,$4,$5) ORDER BY id`,[job.id,a,b,c,d]);
  expect(data.rows.find(x=>x.id===a)).toMatchObject({status:"queued",attempts:0});
  expect(data.rows.find(x=>x.id===b)).toMatchObject({status:"queued",attempts:0});
  expect(data.rows.find(x=>x.id===c)?.status).toBe("needs_review");
  expect(data.rows.find(x=>x.id===d)?.status).toBe("completed");
  const overview=(await statewideOverview())[0];
  expect(overview.status).toBe("queued");
  expect(overview.quota_blocked_tiles).toBe(0);
  expect(overview.resultsComplete).toBe(false);
  await expect(requeueProviderLimitedTiles(job.id)).rejects.toThrow(/No provider-limited/);
 },30000);
 it("enforces an atomic database-wide rate gate without launching imagery",async()=>{
  const job=(await statewideOverview())[0];
  const first=await claimStatewideProcessingSlot(job.id);
  expect(first).toMatchObject({allowed:true,stopped:false});
  const repeated=await claimStatewideProcessingSlot(job.id);
  expect(repeated).toMatchObject({allowed:false,stopped:false,retryAfterSeconds:30});
  // Test the clock transition directly without waiting 30 real seconds.
  await query("UPDATE statewide_ndvi_jobs SET updated_at=now()-interval '35 seconds' WHERE id=$1",[job.id]);
  const next=await claimStatewideProcessingSlot(job.id);
  expect(next.allowed).toBe(true);
  await query("UPDATE statewide_ndvi_jobs SET status='needs_review' WHERE id=$1",[job.id]);
  const stopped=await claimStatewideProcessingSlot(job.id);
  expect(stopped).toMatchObject({allowed:false,stopped:true});
 },30000);

});