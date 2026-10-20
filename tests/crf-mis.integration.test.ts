import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {Client} from "pg";
import fs from "node:fs";
import path from "node:path";
const url=process.env.CAREMAP_PG_INTEGRATION_URL;
const one="00000000-0000-4000-8000-000000000001";
const two="00000000-0000-4000-8000-000000000002";
describe.skipIf(!url)("CRF private ledger SQL constraints with disposable PostgreSQL/PostGIS",()=>{
 const client=new Client({connectionString:url,ssl:false});
 beforeAll(async()=>{
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await client.query(`CREATE TABLE users(id UUID PRIMARY KEY);
    CREATE TABLE lgas(code TEXT PRIMARY KEY,name TEXT NOT NULL);
    INSERT INTO users VALUES ('${one}'),('${two}');
    INSERT INTO lgas VALUES ('BN-MKD','Makurdi');`);
  const m=fs.readFileSync(path.join(process.cwd(),"db/migrations/019_benue_crf_mis.sql"),"utf8");
  await client.query(m);
 },30000);
 afterAll(async()=>{
  for(const table of ["crf_activity_audit","crf_account_reconciliations","crf_corrective_actions",
    "crf_assets","crf_inspections","crf_repayments","crf_instalments","crf_disbursements",
    "crf_loans","crf_cig_members","crf_cigs","crf_communities","crf_role_assignments"]){
    await client.query("DROP TABLE IF EXISTS "+table+" CASCADE").catch(()=>{});
  }
  for(const t of ["lgas","users"])await client.query("DROP TABLE IF EXISTS "+t+" CASCADE").catch(()=>{});
  await client.end().catch(()=>{});
 },30000);
 it("requires two-account external evidence and independent reviewer for ledger items",async()=>{
  await client.query(`INSERT INTO crf_communities(community_code,community_name,lga_code,created_by)
    VALUES('BENUE-TST','Pilot sample','BN-MKD','${one}')`);
  const c=await client.query(`INSERT INTO crf_cigs(community_id,cig_code,cig_name,
    enterprise_type,created_by) SELECT id,'CIG-01','Test Group','Crop farming','${one}'
    FROM crf_communities RETURNING id`);
  const cig=c.rows[0].id;
  for(let i=0;i<15;i++){
    await client.query(`INSERT INTO crf_cig_members(cig_id,member_reference,sex,recorded_by)
      VALUES($1,$2,$3,$4)`,[cig,"MEM-"+i,i<6?"female":"male",one]);
  }
  const loan=await client.query(`INSERT INTO crf_loans(
    cig_id,loan_reference,cycle,principal_ngn,approved_ceiling_ngn,
    cbn_rate_reference,tenor_months,approval_memo_ref,approval_date,agreement_ref,created_by)
    VALUES($1,'LOAN-01',1,4500000,4500000,'CBN-MEMO',6,'SPMU-MEMO',
    '2026-01-12','SIGNED-AGREEMENT',$2) RETURNING id,service_charge_ngn`,[cig,one]);
  const loanId=loan.rows[0].id;
  expect(Number(loan.rows[0].service_charge_ngn)).toBe(75000);
  await expect(client.query(`INSERT INTO crf_disbursements(
    loan_id,tranche,amount_ngn,transfer_date,bank_reference,t15_endorsement_ref,evidence_ref,
    account_source,recorded_by) VALUES($1,1,3150000,'2026-01-15','BANK-01','T15C','STMT','account_2',$2)`,[loanId,one])).rejects.toThrow();
  const d=await client.query(`INSERT INTO crf_disbursements(
    loan_id,tranche,amount_ngn,transfer_date,bank_reference,t15_endorsement_ref,evidence_ref,
    recorded_by) VALUES($1,1,3150000,'2026-01-15','BANK-01','T15C','STMT',$2) RETURNING id`,[loanId,one]);
  await expect(client.query(`UPDATE crf_disbursements SET
    verification='verified',verified_by=$1 WHERE id=$2`,[one,d.rows[0].id])).rejects.toThrow();
  await client.query(`UPDATE crf_disbursements SET
    verification='verified',verified_by=$1 WHERE id=$2`,[two,d.rows[0].id]);
  const check=await client.query("SELECT verification,account_source,channel FROM crf_disbursements WHERE id=$1",[d.rows[0].id]);
  expect(check.rows[0]).toMatchObject({verification:"verified",account_source:"account_1",channel:"bank_transfer"});
  await expect(client.query(`INSERT INTO crf_repayments(
    loan_id,paid_at,principal_ngn,bank_reference,bank_evidence_ref,account_destination,recorded_by)
    VALUES($1,'2026-02-15',500000,'REPAY-01','STMT-2','account_1',$2)`,[loanId,one])).rejects.toThrow();
  const rep=await client.query(`INSERT INTO crf_repayments(
    loan_id,paid_at,principal_ngn,bank_reference,bank_evidence_ref,recorded_by)
    VALUES($1,'2026-02-15',500000,'REPAY-01','STMT-2',$2) RETURNING id`,[loanId,one]);
  await client.query(`UPDATE crf_repayments SET
    verification='verified',verified_by=$1 WHERE id=$2`,[two,rep.rows[0].id]);
  const saved=await client.query("SELECT verification,principal_ngn FROM crf_repayments WHERE id=$1",[rep.rows[0].id]);
  expect(saved.rows[0].verification).toBe("verified");
  expect(Number(saved.rows[0].principal_ngn)).toBe(500000);
 },30000);
});
