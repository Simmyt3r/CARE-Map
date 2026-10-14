import {afterAll,describe,expect,it} from "vitest";
import {Client} from "pg";
import {RISK_REFRESH_SQL} from "../src/lib/risk-refresh";

/**
 * Executed against a throwaway PostGIS instance in CI, never against Aiven.
 * The test rolls back even after an error, leaving no fixture records.
 */
const connectionString=process.env.CAREMAP_PG_INTEGRATION_URL;
describe.skipIf(!connectionString)("scheduled maintenance PostgreSQL integration",()=>{
  const client=new Client({connectionString,ssl:false,connectionTimeoutMillis:10_000});
  let connected=false;
  afterAll(async()=>{if(connected){await client.query("ROLLBACK").catch(()=>{});await client.end();}});

  it("recalculates priorities and anonymizes eligible aged reports in one valid SQL batch",async()=>{
    await client.connect();
    connected=true;
    await client.query("BEGIN");
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis");

    // Transaction-local fixture tables shadow ordinary schemas.
    await client.query(`
      CREATE TEMP TABLE boreholes (
        name text, status text, last_maintenance_date date,
        risk_score integer DEFAULT 0, risk_level text DEFAULT 'low'
      );
      CREATE TEMP TABLE assets (
        name text, status text, last_maintenance_date date,
        risk_score integer DEFAULT 0, risk_level text DEFAULT 'low'
      );
      CREATE TEMP TABLE forest_sites (
        name text, boundary geometry(Polygon,4326),
        risk_score integer DEFAULT 0, risk_level text DEFAULT 'low'
      );
      CREATE TEMP TABLE rivers (
        name text, stress_indicator text,
        risk_score integer DEFAULT 0, risk_level text DEFAULT 'low'
      );
      CREATE TEMP TABLE reports (
        id uuid, status text, location geometry(Point,4326),
        reporter_name text, reporter_contact text, submitted_by uuid,
        resolved_at timestamptz, anonymized_at timestamptz
      );
      CREATE TABLE public.privacy_notice_acceptances(
        user_id uuid,report_id uuid
      );
    `);
    await client.query(`
      INSERT INTO boreholes(name,status,last_maintenance_date)
        VALUES ('good','functional',CURRENT_DATE),
               ('broken','non_functional',CURRENT_DATE-INTERVAL '500 days');
      INSERT INTO assets(name,status,last_maintenance_date)
        VALUES ('needs attention','needs_maintenance',CURRENT_DATE-INTERVAL '500 days');
      INSERT INTO forest_sites(name,boundary)
        VALUES ('forest',ST_GeomFromText('POLYGON((8.49 7.69,8.51 7.69,8.51 7.71,8.49 7.71,8.49 7.69))',4326));
      INSERT INTO rivers(name,stress_indicator) VALUES('river','high');
      INSERT INTO reports(id,status,location,reporter_name,reporter_contact,submitted_by,resolved_at)
        VALUES('00000000-0000-4000-8000-000000000001','resolved',ST_SetSRID(ST_MakePoint(8.5,7.7),4326),
               'Example Name','0000000','00000000-0000-4000-8000-000000000009',now()-INTERVAL '3 years'),
              ('00000000-0000-4000-8000-000000000002','submitted',ST_SetSRID(ST_MakePoint(8.5,7.7),4326),
               NULL,NULL,NULL,NULL);
      INSERT INTO public.privacy_notice_acceptances(user_id,report_id)
        VALUES('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001');
    `);
    await client.query(RISK_REFRESH_SQL);
    const boreholes=await client.query<{name:string;risk_score:number;risk_level:string}>(
      "SELECT name,risk_score,risk_level FROM boreholes ORDER BY name");
    expect(boreholes.rows).toEqual([
      {name:"broken",risk_score:100,risk_level:"critical"},
      {name:"good",risk_score:10,risk_level:"low"}
    ]);
    const asset=await client.query<{risk_score:number;risk_level:string}>(
      "SELECT risk_score,risk_level FROM assets");
    expect(asset.rows[0]).toMatchObject({risk_score:90,risk_level:"critical"});
    const forest=await client.query<{risk_score:number}>("SELECT risk_score FROM forest_sites");
    expect(forest.rows[0]?.risk_score).toBe(25);
    const river=await client.query<{risk_score:number;risk_level:string}>(
      "SELECT risk_score,risk_level FROM rivers");
    expect(river.rows[0]).toMatchObject({risk_score:80,risk_level:"critical"});
    const retired=await client.query<{
      reporter_name:string|null;reporter_contact:string|null;submitted_by:string|null;anonymized:boolean
    }>(`SELECT reporter_name,reporter_contact,submitted_by,
        anonymized_at IS NOT NULL AS anonymized FROM reports
        WHERE id='00000000-0000-4000-8000-000000000001'`);
    expect(retired.rows[0]).toEqual({
      reporter_name:null,reporter_contact:null,submitted_by:null,anonymized:true
    });
    const consents=await client.query<{user_id:string|null}>(
      "SELECT user_id FROM public.privacy_notice_acceptances");
    expect(consents.rows[0]?.user_id).toBeNull();
    // Existing unresolved reports must not be anonymized by age alone.
    const pending=await client.query<{anonymized_at:string|null}>(
      "SELECT anonymized_at FROM reports WHERE id='00000000-0000-4000-8000-000000000002'");
    expect(pending.rows[0]?.anonymized_at).toBeNull();
  },25_000);
});
