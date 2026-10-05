import fs from "node:fs";
import path from "node:path";
import pg from "pg";
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const ca=process.env.AIVEN_CA_CERT?.replace(/\\n/g,"\n");
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:false}});
await client.connect();
try{
 const dir=path.join(process.cwd(),"db","migrations");
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith(".sql")).sort()){
  console.log("Applying",file);
  await client.query(fs.readFileSync(path.join(dir,file),"utf8"));
 }
 console.log("Migrations complete.");
}finally{await client.end();}
