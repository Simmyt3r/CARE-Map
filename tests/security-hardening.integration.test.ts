import crypto from "node:crypto";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {Pool,type PoolClient} from "pg";
import {rateLimitWithQuery} from "../src/lib/http";
import {acquireMigrationLock,applyMigrationFile,migrationSqlBody,releaseMigrationLock} from "../src/lib/migration-runner";
import {updateAdminAccount} from "../src/lib/admin-users";

const connectionString=process.env.CAREMAP_PG_INTEGRATION_URL;
describe.skipIf(!connectionString)("serverless security with real concurrent Postgres clients",()=>{
  const db=new Pool({connectionString,ssl:false,max:4,connectionTimeoutMillis:10_000});
  let a:PoolClient,b:PoolClient;
  const schema="care_security_"+crypto.randomUUID().replace(/-/g,"");
  const actorA="00000000-0000-4000-8000-000000000071";
  const actorB="00000000-0000-4000-8000-000000000072";
  const password="test-only-rate-limit-secret-longer-than-32";
  const original=process.env.SESSION_SECRET;
  beforeAll(async()=>{
    a=await db.connect();b=await db.connect();
    await a.query("CREATE SCHEMA "+schema);
    await a.query("SET search_path TO "+schema);
    await b.query("SET search_path TO "+schema);
    await a.query(`
      CREATE TABLE api_rate_limit_buckets(
        key_hash CHAR(64) PRIMARY KEY,hits INTEGER NOT NULL,reset_at timestamptz NOT NULL);
      CREATE TABLE care_map_schema_migrations(
        filename TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at timestamptz DEFAULT now());
      CREATE TABLE users(
        id UUID PRIMARY KEY,email TEXT,name TEXT,role TEXT,active BOOLEAN NOT NULL,
        deleted_at timestamptz,disabled_reason TEXT,last_login_at timestamptz);
      CREATE TABLE audit_logs(
        actor_id UUID,action TEXT,entity_type TEXT,entity_id UUID,metadata JSONB);
      INSERT INTO users(id,email,name,role,active) VALUES
        ('${actorA}','a@example.test','A','admin',TRUE),
        ('${actorB}','b@example.test','B','admin',TRUE);
    `);
    process.env.SESSION_SECRET=password;
  },20_000);
  afterAll(async()=>{
    process.env.SESSION_SECRET=original;
    if(a)a.release();
    if(b)b.release();
    await db.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE").catch(()=>{});
    await db.end();
  },20_000);

  const run=(client:PoolClient)=>(sql:string,params:unknown[])=>
    client.query<{current_hits:number}>(sql,params);

  it("enforces a shared limit exactly once across concurrent connections",async()=>{
    const results=await Promise.all(
      Array.from({length:32},(_,i)=>
        rateLimitWithQuery("login:198.51.100.4",8,60_000,run(i%2===0?a:b))));
    expect(results.filter(Boolean)).toHaveLength(8);
    expect(results.filter(x=>!x)).toHaveLength(24);
    const rows=await a.query<{key_hash:string;hits:number}>("SELECT key_hash,hits FROM api_rate_limit_buckets");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.key_hash.trim()).toMatch(/^[a-f0-9]{64}$/);
    expect(rows.rows[0]?.hits).toBe(9); // capped at limit+1
    await a.query("UPDATE api_rate_limit_buckets SET reset_at=clock_timestamp()-interval '1 second'");
    expect(await rateLimitWithQuery("login:198.51.100.4",8,60_000,run(b))).toBe(true);
    const reset=await a.query("SELECT hits FROM api_rate_limit_buckets");
    expect(reset.rows[0].hits).toBe(1);
  });

  it("rolls back migration DDL when the migration or ledger write fails",async()=>{
    await acquireMigrationLock(a);
    await expect(acquireMigrationLock(b)).rejects.toThrow(/Another migration runner/);
    await expect(applyMigrationFile(a,{
      filename:"broken.sql",checksum:"bad",
      content:"BEGIN; CREATE TABLE rolled_back(id INTEGER); SELECT missing_column FROM no_such_table; COMMIT;"
    })).rejects.toThrow();
    const absent=await a.query<{present:string|null}>("SELECT to_regclass('rolled_back') present");
    expect(absent.rows[0]?.present).toBeNull();
    const noLedger=await a.query("SELECT filename FROM care_map_schema_migrations");
    expect(noLedger.rowCount).toBe(0);
    await applyMigrationFile(a,{
      filename:"ok.sql",checksum:"verified",
      content:"BEGIN; CREATE TABLE committed(id INTEGER); COMMIT;"
    });
    const yes=await a.query("SELECT filename,checksum FROM care_map_schema_migrations");
    expect(yes.rows).toEqual([{filename:"ok.sql",checksum:"verified"}]);
    await releaseMigrationLock(a);
    await acquireMigrationLock(b);
    await releaseMigrationLock(b);
  });

  it("rejects partial or nontransactional SQL delimiters",()=>{
    expect(()=>migrationSqlBody("BEGIN; SELECT 1;")).toThrow(/unmatched/);
    expect(()=>migrationSqlBody("CREATE INDEX CONCURRENTLY idx ON x(y);")).toThrow(/unsupported/i);
  });

  it("prevents two administrators from simultaneously removing each other",async()=>{
    const [one,two]=await Promise.all([
      updateAdminAccount(a,actorA,actorB,{role:"staff"}),
      updateAdminAccount(b,actorB,actorA,{role:"staff"})
    ]);
    expect([one.ok,two.ok].filter(Boolean)).toHaveLength(1);
    const admins=await a.query("SELECT id FROM users WHERE role='admin' AND active=TRUE");
    expect(admins.rowCount).toBe(1);
    const audit=await a.query("SELECT * FROM audit_logs");
    expect(audit.rowCount).toBe(1);
    const survivingId=admins.rows[0].id as string;
    const result=await updateAdminAccount(a,survivingId,survivingId,{active:false});
    expect(result.ok).toBe(false);
    expect((await a.query("SELECT id FROM users WHERE role='admin' AND active=TRUE")).rowCount).toBe(1);
  });

  it("rolls back user role if the audit insert fails",async()=>{
    const rows=await a.query<{id:string}>("SELECT id FROM users WHERE role='admin' AND active=TRUE");
    const adminId=rows.rows[0].id;
    const targetId=adminId===actorA?actorB:actorA;
    await a.query("ALTER TABLE audit_logs ADD CONSTRAINT audit_failure CHECK(FALSE)");
    await expect(updateAdminAccount(a,adminId,targetId,{role:"admin"})).rejects.toThrow();
    const state=await a.query("SELECT role FROM users WHERE id=$1",[targetId]);
    expect(state.rows[0].role).toBe("staff");
    await a.query("ALTER TABLE audit_logs DROP CONSTRAINT audit_failure");
  });
});
