#!/usr/bin/env node
/**
 * Explicit, one-time operator bootstrap for administrative geography.
 * Replaces ONLY the untouched historical migration seed in an otherwise
 * empty environment. Never run against an established deployment.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file=process.argv[2];
const consent=process.env.CAREMAP_GEOGRAPHY_BOOTSTRAP_CONFIRM;
if(!file||consent!=="REPLACE_EMPTY_INITIAL_GEOGRAPHY"){
  throw new Error("Usage: CAREMAP_GEOGRAPHY_BOOTSTRAP_CONFIRM=REPLACE_EMPTY_INITIAL_GEOGRAPHY npm run geo:bootstrap -- /path/to/approved-areas.json");
}
if(!process.env.DATABASE_URL||!process.env.AIVEN_CA_CERT){
  throw new Error("Verified DATABASE_URL and AIVEN_CA_CERT are required.");
}
const ca=process.env.AIVEN_CA_CERT.replace(/\\n/g,"\n");
if(!ca.includes("-----BEGIN CERTIFICATE-----")||!ca.includes("-----END CERTIFICATE-----"))
  throw new Error("AIVEN_CA_CERT must be a PEM certificate.");
const input=JSON.parse(fs.readFileSync(path.resolve(file),"utf8"));
if(typeof input?.regionName!=="string"||input.regionName.trim().length<2||
   typeof input?.provenance!=="string"||input.provenance.trim().length<8||
   !Array.isArray(input.areas)||!input.areas.length||input.areas.length>1000){
  throw new Error("Provide regionName, authoritative provenance and 1–1000 administrative areas.");
}
const codes=new Set(),names=new Set();
const areas=input.areas.map((raw,index)=>{
  const code=String(raw?.code??"").trim().toUpperCase();
  const name=String(raw?.name??"").trim();
  const pilot=raw?.pilot===true;
  if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)||name.length<2||name.length>120||
     (raw?.pilot!==undefined&&typeof raw.pilot!=="boolean"))
    throw new Error("Invalid area at index "+index+".");
  if(codes.has(code)||names.has(name.toLocaleLowerCase()))
    throw new Error("Duplicate administrative area code or name.");
  codes.add(code);names.add(name.toLocaleLowerCase());
  return {code,name,pilot};
});
if(!areas.some(x=>x.pilot))throw new Error("Mark at least one approved pilot area for field acceptance.");

const migration=fs.readFileSync(path.join(process.cwd(),"db/migrations/001_init.sql"),"utf8");
const seedBlock=migration.split("INSERT INTO lgas(code,name,pilot) VALUES")[1]?.split("ON CONFLICT")[0];
if(!seedBlock)throw new Error("Historical seed definition could not be verified.");
const initialRows=[...seedBlock.matchAll(/\('([^']+)','([^']+)',(TRUE|FALSE)\)/g)]
  .map(m=>({code:m[1],name:m[2],pilot:m[3]==="TRUE"}));
if(initialRows.length<1)throw new Error("Historical seed does not contain verified area rows.");
const initial=new Map(initialRows.map(x=>[x.code,x]));

const uri=new URL(process.env.DATABASE_URL);
if(!["postgres:","postgresql:"].includes(uri.protocol))throw new Error("Invalid PostgreSQL URL.");
for(const key of ["sslmode","sslrootcert","sslcert","sslkey"])uri.searchParams.delete(key);
const client=new pg.Client({connectionString:uri.toString(),ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:10000});
await client.connect();
let committed=false;
try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(93174)");
  const existing=await client.query("SELECT code,name,pilot,boundary FROM lgas FOR UPDATE");
  if(existing.rows.some(x=>x.boundary!==null))
    throw new Error("Existing approved boundaries found; refusing to replace geography.");
  if(existing.rows.length>0&&(
    existing.rows.length!==initial.size||
    existing.rows.some(x=>!initial.has(x.code)||x.name!==initial.get(x.code).name||x.pilot!==initial.get(x.code).pilot)
  ))throw new Error("Geography differs from untouched initial seed; refusing replacement.");
  const tables=["boreholes","assets","forest_sites","rivers","reports","settlements",
    "hazard_zones","catchments","field_acceptance_runs","extension_communities",
    "vegetation_monitors","remote_sensing_analyses","crf_communities"];
  for(const table of tables){
    const present=await client.query("SELECT to_regclass($1) AS relation",["public."+table]);
    if(present.rows[0]?.relation){
      const hasRows=await client.query("SELECT EXISTS(SELECT 1 FROM "+table+" LIMIT 1) AS populated");
      if(hasRows.rows[0]?.populated)throw new Error("Operational records exist in "+table+"; refusing replacement.");
    }
  }
  await client.query("DELETE FROM lgas");
  for(const area of areas){
    await client.query("INSERT INTO lgas(code,name,pilot) VALUES($1,$2,$3)",[area.code,area.name,area.pilot]);
  }
  await client.query("COMMIT");committed=true;
  console.log("Administrative geography initialized:",{region:input.regionName,areas:areas.length,pilots:areas.filter(x=>x.pilot).length,provenance:input.provenance});
  console.log("Next: import authoritative boundaries, configure approved region label and complete field acceptance.");
}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
finally{await client.end();if(!committed)console.error("No changes committed.");}
