import bcrypt from "bcryptjs";
import pg from "pg";
const {DATABASE_URL,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
if(!DATABASE_URL||!ADMIN_EMAIL||!ADMIN_PASSWORD) throw new Error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
if(ADMIN_PASSWORD.length<12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
const ca=process.env.AIVEN_CA_CERT?.replace(/\\n/g,"\n");
const client=new pg.Client({connectionString:DATABASE_URL,ssl:ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:false}});
await client.connect();
try{
 const hash=await bcrypt.hash(ADMIN_PASSWORD,12);
 await client.query("INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,'CARE-Map Administrator','admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='admin',active=TRUE,deleted_at=NULL",[ADMIN_EMAIL,hash]);
 console.log("Admin account seeded.");
}finally{await client.end();}
