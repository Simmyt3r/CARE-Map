import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {Client} from "pg";
import {resolveSpatialContext,parsePoint,informativeLocationText} from "../src/lib/spatial-context";
import {pool} from "../src/lib/db";

const url=process.env.CAREMAP_PG_INTEGRATION_URL;
describe.skipIf(!url)("GIS context against real PostGIS",()=>{
 const c=new Client({connectionString:url,ssl:false});
 const names=["community_interventions","rivers","forest_sites","assets","boreholes","settlements","lgas"];
 beforeAll(async()=>{
  process.env.DATABASE_URL=url;
  delete process.env.AIVEN_CA_CERT;
  await c.connect();
  await c.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await c.query(`
    CREATE TABLE lgas(code text primary key,name text,boundary geometry(Polygon,4326),boundary_source text);
    CREATE TABLE settlements(id uuid,name text,lga_code text,location geometry(Point,4326),verified boolean,source text);
    CREATE TABLE boreholes(id uuid,name text,lga_code text,location geometry(Point,4326),status text);
    CREATE TABLE assets(id uuid,name text,lga_code text,location geometry(Point,4326),status text);
    CREATE TABLE forest_sites(id uuid,name text,lga_code text,boundary geometry(Polygon,4326),status text);
    CREATE TABLE rivers(id uuid,name text,local_name text,lga_code text,course geometry(LineString,4326),
      stress_indicator text,verified boolean);
    CREATE TABLE community_interventions(id uuid,project_name text,lga_code text,location geometry(Point,4326),
      project_status text,location_review text,contact_name text,contact_phone text);
    INSERT INTO lgas(code,name,boundary,boundary_source) VALUES
    ('LGA1','Makurdi Test',
      ST_GeomFromText('POLYGON((8.48 7.68,8.53 7.68,8.53 7.77,8.48 7.77,8.48 7.68))',4326),
      'test boundary'),
    ('LGA2','Guma Test',
      ST_GeomFromText('POLYGON((8.53 7.68,8.59 7.68,8.59 7.77,8.53 7.77,8.53 7.68))',4326),
      'test boundary');
    INSERT INTO settlements VALUES
    ('10000000-0000-4000-8000-000000000001','Community A','LGA1',ST_SetSRID(ST_MakePoint(8.51,7.72),4326),FALSE,'sample'),
    ('10000000-0000-4000-8000-000000000002','Community B','LGA2',ST_SetSRID(ST_MakePoint(8.54,7.72),4326),TRUE,'survey');
    INSERT INTO boreholes VALUES
    ('20000000-0000-4000-8000-000000000001','Borehole A','LGA1',ST_SetSRID(ST_MakePoint(8.51,7.72),4326),'functional');
    INSERT INTO assets VALUES
    ('30000000-0000-4000-8000-000000000001','Asset Outside','LGA1',ST_SetSRID(ST_MakePoint(8.60,7.72),4326),'functional');
    INSERT INTO community_interventions VALUES
    ('40000000-0000-4000-8000-000000000001','Erosion Project','LGA2',
      ST_SetSRID(ST_MakePoint(8.54,7.72),4326),'active','pending',
      'PERSONAL NAME NOT FOR EXPORT','PRIVATE PHONE NOT FOR EXPORT');
  `);
 },30_000);
 afterAll(async()=>{
  await pool().end().catch(()=>{});
  for(const name of names)await c.query("DROP TABLE IF EXISTS "+name).catch(()=>{});
  await c.end().catch(()=>{});
 },30_000);

 it("identifies overlapping LGAs and mapped communities without pretending point names are verified regions",async()=>{
  const poly={type:"Polygon",coordinates:[[[8.50,7.70],[8.55,7.70],[8.55,7.75],[8.50,7.75],[8.50,7.70]]]};
  const result=await resolveSpatialContext(poly);
  expect(result.scope).toBe("area");
  expect(result.state).toBe("Benue");
  expect(result.lgas.map(x=>x.code)).toEqual(["LGA1","LGA2"]);
  expect(result.lgas.reduce((sum,l)=>sum+(l.coveragePct||0),0)).toBeCloseTo(100,0);
  expect(result.communities.map(c=>c.name)).toContain("Community A");
  expect(result.communities.find(c=>c.name==="Community A")?.verified).toBe(false);
  expect(result.assets.map(a=>a.name)).toContain("Borehole A");
  expect(result.assets.map(a=>a.name)).toContain("Erosion Project");
  expect(result.assets.map(a=>a.name)).not.toContain("Asset Outside");
  expect(result.warnings.join(" ")).toMatch(/whole AOI/);
  expect(JSON.stringify(result)).not.toContain("PERSONAL NAME NOT FOR EXPORT");
  expect(JSON.stringify(result)).not.toContain("PRIVATE PHONE NOT FOR EXPORT");
 },30_000);

 it("identifies a single LGA for coordinate-based analysis and distances",async()=>{
  const result=await resolveSpatialContext(parsePoint(7.72,8.51),2500);
  expect(result.scope).toBe("point");
  expect(result.lgas.map(x=>x.code)).toEqual(["LGA1"]);
  expect(result.assets.some(x=>x.kind==="borehole"&&x.inside)).toBe(true);
  expect(informativeLocationText(result)).toContain("Makurdi Test LGA, Benue State");
 },30_000);

 it("does not invent a Nigerian state/LGA outside known coverage",async()=>{
  const result=await resolveSpatialContext(parsePoint(4.5,3.5));
  expect(result.state).toBeNull();
  expect(result.lgas).toHaveLength(0);
  expect(result.communityMatch).toBe("not_found");
  expect(result.warnings.join(" ")).toMatch(/state and LGA are not confirmed/);
 },30_000);
});
