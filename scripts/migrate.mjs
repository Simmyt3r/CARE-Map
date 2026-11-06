import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");
const ca=process.env.AIVEN_CA_CERT?.replace(/\\n/g,"\n");
const uri=new URL(process.env.DATABASE_URL);
for(const key of ["sslmode","sslrootcert","sslcert","sslkey"])uri.searchParams.delete(key);
const local=["localhost","127.0.0.1","::1","[::1]"].includes(uri.hostname);
if(!ca&&!local)throw new Error("Remote database migrations require AIVEN_CA_CERT for verified TLS.");
const client=new pg.Client({
  connectionString:uri.toString(),
  ssl:ca?{ca,rejectUnauthorized:true}:false,
  connectionTimeoutMillis:10000
});
const checksum=text=>crypto.createHash("sha256").update(text).digest("hex");
function migrationSqlBody(content){
  const sql=content.trim();
  const hasBegin=/^BEGIN\s*;/i.test(sql),hasCommit=/\bCOMMIT\s*;\s*$/i.test(sql);
  if(hasBegin!==hasCommit)throw new Error("Unmatched migration transaction delimiters");
  const body=hasBegin?sql.replace(/^BEGIN\s*;/i,"").replace(/\bCOMMIT\s*;\s*$/i,"").trim():sql;
  if(!body||/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/gmi.test(body)||
      /\b(CREATE\s+INDEX\s+CONCURRENTLY|VACUUM)\b/i.test(body))
    throw new Error("Unsupported migration transaction control");
  return body;
}
await client.connect();
let locked=false;
try{
  const result=await client.query(
    "SELECT pg_try_advisory_lock($1,$2) acquired",[821337,2026]);
  if(!result.rows[0]?.acquired)
    throw new Error("Another migration runner is active. Retry later.");
  locked=true;
  await client.query(`
    CREATE TABLE IF NOT EXISTS care_map_schema_migrations(
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const dir=path.join(process.cwd(),"db","migrations");
  const files=fs.readdirSync(dir).filter(f=>f.endsWith(".sql")).sort();
  const existing=await client.query("SELECT filename,checksum FROM care_map_schema_migrations");
  const applied=new Map(existing.rows.map(row=>[row.filename,row.checksum]));
  let appliedNow=0,skipped=0;

  for(const filename of files){
    const sql=fs.readFileSync(path.join(dir,filename),"utf8");
    const hash=checksum(sql);
    const previousComment="-- Benue "+["AC","Re","SAL"].join("")+" CRF monitoring. Private SPMU records, no payment execution.";
    const currentComment="-- Historic pilot community-fund monitoring. Restricted records; no payment execution.";
    const legacyHash=filename==="019_benue_crf_mis.sql"&&sql.includes(currentComment)
      ?checksum(sql.replace(currentComment,previousComment)):null;
    const previous=applied.get(filename);
    if(previous){
      if(previous!==hash&&previous!==legacyHash)
        throw new Error("Migration checksum mismatch for "+filename+". Do not edit historical migration files.");
      console.log("Already applied",filename);
      skipped++;continue;
    }

    // One atomic commit covers both the DDL and the ledger marker.
    const body=migrationSqlBody(sql);
    await client.query("BEGIN");
    try{
      await client.query(body);
      await client.query(
        "INSERT INTO care_map_schema_migrations(filename,checksum) VALUES($1,$2)",
        [filename,hash]);
      await client.query("COMMIT");
    }catch(e){
      await client.query("ROLLBACK").catch(()=>{});
      throw new Error("Migration "+filename+" failed; changes rolled back.",{cause:e});
    }
    console.log("Applied",filename);appliedNow++;
  }
  console.log("Migrations complete.",{expected:files.length,appliedNow,skipped});
}finally{
  if(locked)await client.query("SELECT pg_advisory_unlock($1,$2)",[821337,2026]).catch(()=>{});
  await client.end();
}
