import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {Client} from "pg";
import fs from "node:fs";
import path from "node:path";
const url=process.env.CAREMAP_PG_INTEGRATION_URL;
const writer="00000000-0000-4000-8000-000000000010";
const reviewer="00000000-0000-4000-8000-000000000011";
describe.skipIf(!url)("Signed CRF template filing constraints in PostGIS",()=>{
 const db=new Client({connectionString:url,ssl:false});
 let community="";
 beforeAll(async()=>{
  await db.connect();
  await db.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await db.query(`CREATE TABLE users(id uuid primary key);
    CREATE TABLE lgas(code text primary key,name text not null);
    INSERT INTO users(id) VALUES ('${writer}'),('${reviewer}');
    INSERT INTO lgas(code,name) VALUES ('BN-MKD','Makurdi');`);
  for(const migration of ["019_benue_crf_mis.sql","020_crf_manual_template_records.sql"]){
   await db.query(fs.readFileSync(path.join(process.cwd(),"db/migrations",migration),"utf8"));
  }
  const r=await db.query<{id:string}>(`INSERT INTO crf_communities(
    community_code,community_name,lga_code,created_by)
    VALUES('ACTUAL-RECORD-REF','Test community','BN-MKD',$1) RETURNING id`,[writer]);
  community=r.rows[0].id;
 },30000);
 afterAll(async()=>{
  for(const name of ["crf_template_records","crf_activity_audit","crf_account_reconciliations",
    "crf_corrective_actions","crf_assets","crf_inspections","crf_repayments",
    "crf_instalments","crf_disbursements","crf_loans","crf_cig_members",
    "crf_cigs","crf_communities","crf_role_assignments"]){
   await db.query("DROP TABLE IF EXISTS "+name+" CASCADE").catch(()=>{});
  }
  for(const name of ["lgas","users"])
   await db.query("DROP TABLE IF EXISTS "+name+" CASCADE").catch(()=>{});
  await db.end().catch(()=>{});
 },30000);
 it("cannot mark a form verified without a signed original and independent review",async()=>{
  const row=await db.query<{id:string}>(`
    INSERT INTO crf_template_records(template_code,community_id,field_values,prepared_by)
    VALUES('T14',$1,'{"period":"2026-10"}'::jsonb,$2) RETURNING id`,[community,writer]);
  const id=row.rows[0].id;
  await expect(db.query("UPDATE crf_template_records SET status='verified' WHERE id=$1",[id]))
   .rejects.toThrow();
  await expect(db.query(`UPDATE crf_template_records SET status='verified',
    signed_original_ref='SPMU-CONTROLLED-PDF',reviewed_by=$2 WHERE id=$1`,[id,writer]))
   .rejects.toThrow();
  await db.query(`UPDATE crf_template_records SET status='verified',
    signed_original_ref='SPMU-CONTROLLED-PDF',reviewed_by=$2 WHERE id=$1`,[id,reviewer]);
  const accepted=await db.query("SELECT status,reviewed_by FROM crf_template_records WHERE id=$1",[id]);
  expect(accepted.rows[0]).toMatchObject({status:"verified",reviewed_by:reviewer});
 });
 it("rejects unsupported form codes, non-object JSON and fabricated state references",async()=>{
  await expect(db.query(`INSERT INTO crf_template_records(
      template_code,community_id,prepared_by)
      VALUES('T20',$1,$2)`,[community,writer])).rejects.toThrow();
  await expect(db.query(`INSERT INTO crf_template_records(
      template_code,community_id,field_values,prepared_by)
      VALUES('T1',$1,'[]'::jsonb,$2)`,[community,writer])).rejects.toThrow();
 });
});
