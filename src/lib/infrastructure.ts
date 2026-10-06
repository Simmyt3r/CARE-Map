import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

export type AivenConfig={databaseUrl:string;caCert?:string};
export type DbCheck={
  ok:boolean;host?:string;database?:string;user?:string;postgresVersion?:string;
  postgisEnabled?:boolean;postgisVersion?:string|null;tables?:number;error?:string;
};

function ssl(caCert?:string){
  const ca=caCert?.trim().replace(/\\n/g,"\n");
  return ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:false};
}

export function describeDatabaseUrl(value?:string){
  if(!value)return null;
  try{
    const u=new URL(value);
    return {host:u.hostname,port:u.port||"5432",database:u.pathname.replace(/^\//,"")||"defaultdb",user:decodeURIComponent(u.username||"")};
  }catch{return null;}
}

export async function checkDatabase(config:AivenConfig):Promise<DbCheck>{
  if(!config.databaseUrl?.trim())return{ok:false,error:"Database service URI is required."};
  const info=describeDatabaseUrl(config.databaseUrl);
  const client=new pg.Client({connectionString:config.databaseUrl,ssl:ssl(config.caCert),connectionTimeoutMillis:10000});
  try{
    await client.connect();
    const base=await client.query<{database:string;user_name:string;version:string;postgis_enabled:boolean;tables:string}>(
      "SELECT current_database() database,current_user user_name,current_setting('server_version') version,"+
      "EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis') postgis_enabled,"+
      "(SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public') tables"
    );
    const enabled=Boolean(base.rows[0]?.postgis_enabled);
    let postgisVersion:string|null=null;
    if(enabled){
      const ext=await client.query<{version:string}>("SELECT postgis_lib_version() version");
      postgisVersion=ext.rows[0]?.version||null;
    }
    return{
      ok:true,host:info?.host,database:base.rows[0]?.database||info?.database,user:base.rows[0]?.user_name||info?.user,
      postgresVersion:base.rows[0]?.version,postgisEnabled:enabled,postgisVersion,tables:Number(base.rows[0]?.tables||0)
    };
  }catch(e){
    return{ok:false,host:info?.host,database:info?.database,user:info?.user,error:e instanceof Error?e.message:"Database connection failed."};
  }finally{
    await client.end().catch(()=>{});
  }
}

export async function initializeDatabase(config:AivenConfig){
  const client=new pg.Client({connectionString:config.databaseUrl,ssl:ssl(config.caCert),connectionTimeoutMillis:10000});
  await client.connect();
  try{
    const dir=path.join(process.cwd(),"db","migrations");
    const migrations=fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort();
    for(const file of migrations)await client.query(fs.readFileSync(path.join(dir,file),"utf8"));
    const ext=await client.query<{version:string}>("SELECT postgis_lib_version() version");
    return{ok:true,migrations:migrations.length,postgisVersion:ext.rows[0]?.version||null};
  }finally{
    await client.end();
  }
}

export async function bootstrapAdmin(config:AivenConfig,email:string,password:string,name="CARE-Map Administrator"){
  if(password.length<12)throw new Error("Administrator password must be at least 12 characters.");
  const client=new pg.Client({connectionString:config.databaseUrl,ssl:ssl(config.caCert),connectionTimeoutMillis:10000});
  await client.connect();
  try{
    const exists=await client.query("SELECT to_regclass('public.users') AS users_table");
    if(!exists.rows[0]?.users_table)throw new Error("CARE-Map schema is not initialized yet.");
    const hash=await bcrypt.hash(password,12);
    const sql="INSERT INTO users(email,password_hash,name,role,active) VALUES($1,$2,$3,'admin',TRUE) "+
      "ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,name=EXCLUDED.name,role='admin',active=TRUE,deleted_at=NULL "+
      "RETURNING id,email";
    const result=await client.query<{id:string,email:string}>(sql,[email,hash,name]);
    return{ok:true,id:result.rows[0]?.id,email:result.rows[0]?.email};
  }finally{
    await client.end();
  }
}

export async function currentInfrastructureSnapshot(){
  const databaseUrl=process.env.DATABASE_URL;
  const details=describeDatabaseUrl(databaseUrl);
  let database:DbCheck={ok:false,error:"DATABASE_URL is not configured."};
  if(databaseUrl)database=await checkDatabase({databaseUrl,caCert:process.env.AIVEN_CA_CERT});
  return{
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||"unknown",
    databaseConfigured:Boolean(databaseUrl),
    caConfigured:Boolean(process.env.AIVEN_CA_CERT),
    sessionSecretConfigured:Boolean(process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32),
    cronSecretConfigured:Boolean(process.env.CRON_SECRET&&process.env.CRON_SECRET.length>=24),
    adminSeedConfigured:Boolean(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD),
    databaseHost:details?.host||null,databaseName:details?.database||null,database
  };
}
