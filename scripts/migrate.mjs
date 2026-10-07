import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const ca=process.env.AIVEN_CA_CERT?.replace(/\\n/g,"\n");
const client=new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:false}
});

function checksum(text){
  return crypto.createHash("sha256").update(text).digest("hex");
}

await client.connect();
try{
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

  let appliedNow=0;
  let skipped=0;

  for(const file of files){
    const sql=fs.readFileSync(path.join(dir,file),"utf8");
    const hash=checksum(sql);
    const previous=applied.get(file);

    if(previous){
      if(previous!==hash){
        throw new Error(
          "Migration checksum mismatch for "+file+
          ". Do not edit a migration after it has been applied; add a new migration instead."
        );
      }
      console.log("Already applied",file);
      skipped++;
      continue;
    }

    console.log("Applying",file);
    await client.query(sql);
    await client.query(
      "INSERT INTO care_map_schema_migrations(filename,checksum) VALUES($1,$2)",
      [file,hash]
    );
    appliedNow++;
  }

  console.log("Migrations complete.",{
    expected:files.length,
    appliedNow,
    skipped
  });
}finally{
  await client.end();
}
