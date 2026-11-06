import type {Client} from "pg";

const LOCK_CLASS=821337;
const LOCK_ID=2026;

/** Session-level advisory lock persists across per-migration COMMITs. */
export async function acquireMigrationLock(client:Client){
  const result=await client.query<{acquired:boolean}>(
    "SELECT pg_try_advisory_lock($1,$2) acquired",[LOCK_CLASS,LOCK_ID]);
  if(!result.rows[0]?.acquired)
    throw new Error("Another migration runner is active. Retry once it has finished.");
}

export async function releaseMigrationLock(client:Client){
  await client.query("SELECT pg_advisory_unlock($1,$2)",[LOCK_CLASS,LOCK_ID]);
}

/** Historical migrations include BEGIN/COMMIT wrappers; the runner owns the transaction. */
export function migrationSqlBody(content:string){
  const sql=content.trim();
  const hasBegin=/^BEGIN\s*;/i.test(sql);
  const hasCommit=/\bCOMMIT\s*;\s*$/i.test(sql);
  if(hasBegin!==hasCommit)
    throw new Error("Migration contains unmatched transaction delimiters.");
  const body=hasBegin
    ?sql.replace(/^BEGIN\s*;/i,"").replace(/\bCOMMIT\s*;\s*$/i,"").trim()
    :sql;
  if(!body||/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/gmi.test(body)||
     /\b(CREATE\s+INDEX\s+CONCURRENTLY|VACUUM)\b/i.test(body))
    throw new Error("Migration contains unsupported transaction control or non-transactional commands.");
  return body;
}

export async function applyMigrationFile(client:Client,file:{
  filename:string;content:string;checksum:string;
}){
  // Parse before BEGIN, so an invalid file never leaves an open transaction.
  const sql=migrationSqlBody(file.content);
  await client.query("BEGIN");
  try{
    await client.query(sql);
    await client.query(
      "INSERT INTO care_map_schema_migrations(filename,checksum) VALUES($1,$2)",
      [file.filename,file.checksum]
    );
    await client.query("COMMIT");
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    throw e;
  }
}
