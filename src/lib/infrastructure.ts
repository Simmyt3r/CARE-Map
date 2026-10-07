import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg,{type Client} from "pg";
import bcrypt from "bcryptjs";
import {readinessSummary,type ReadinessItem} from "@/lib/readiness";

export type AivenConfig={databaseUrl:string;caCert?:string};
export type DbCheck={
  ok:boolean;host?:string;database?:string;user?:string;postgresVersion?:string;
  postgisEnabled?:boolean;postgisVersion?:string|null;tables?:number;error?:string;
};

export type MigrationStatus={
  historyAvailable:boolean;
  expected:number;
  applied:number;
  pending:string[];
  checksumMismatches:string[];
  latestAppliedAt:string|null;
};

export type DataReadiness={
  lgaBoundaries:number;
  totalLgas:number;
  pilotBoundaries:number;
  pilotLgas:number;
  verifiedRivers:number;
  verifiedSettlements:number;
  boreholes:number;
  assets:number;
  verifiedHazardZones:number;
  verifiedCatchments:number;
  pilotAcceptanceTested:number;
  pilotAcceptancePassed:number;
  admins:number;
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


function migrationFiles(){
  const dir=path.join(process.cwd(),"db","migrations");
  return fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort().map(filename=>{
    const content=fs.readFileSync(path.join(dir,filename),"utf8");
    return{filename,content,checksum:crypto.createHash("sha256").update(content).digest("hex")};
  });
}

async function ensureMigrationLedger(client:Client){
  await client.query(`
    CREATE TABLE IF NOT EXISTS care_map_schema_migrations(
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function migrationStatusOnClient(client:Client):Promise<MigrationStatus>{
  const files=migrationFiles();
  const exists=await client.query<{present:boolean}>(
    "SELECT to_regclass('public.care_map_schema_migrations') IS NOT NULL present"
  );
  if(!exists.rows[0]?.present){
    return{
      historyAvailable:false,expected:files.length,applied:0,
      pending:files.map(x=>x.filename),checksumMismatches:[],latestAppliedAt:null
    };
  }
  const rows=await client.query<{filename:string;checksum:string;applied_at:string}>(
    "SELECT filename,checksum,applied_at FROM care_map_schema_migrations ORDER BY filename"
  );
  const byName=new Map(rows.rows.map(x=>[x.filename,x]));
  const pending:string[]=[];
  const mismatches:string[]=[];
  for(const file of files){
    const saved=byName.get(file.filename);
    if(!saved)pending.push(file.filename);
    else if(saved.checksum!==file.checksum)mismatches.push(file.filename);
  }
  const latest=rows.rows.map(x=>x.applied_at).filter(Boolean).sort().at(-1)||null;
  return{
    historyAvailable:true,expected:files.length,applied:files.length-pending.length,
    pending,checksumMismatches:mismatches,latestAppliedAt:latest
  };
}

export async function initializeDatabase(config:AivenConfig){
  const client=new pg.Client({connectionString:config.databaseUrl,ssl:ssl(config.caCert),connectionTimeoutMillis:10000});
  await client.connect();
  try{
    await ensureMigrationLedger(client);
    const files=migrationFiles();
    const existing=await client.query<{filename:string;checksum:string}>(
      "SELECT filename,checksum FROM care_map_schema_migrations"
    );
    const applied=new Map(existing.rows.map(x=>[x.filename,x.checksum]));
    let appliedNow=0;
    let skipped=0;

    for(const file of files){
      const previous=applied.get(file.filename);
      if(previous){
        if(previous!==file.checksum){
          throw new Error("Migration checksum mismatch for "+file.filename+". Historical migration files must not be edited after application.");
        }
        skipped++;
        continue;
      }
      await client.query(file.content);
      await client.query(
        "INSERT INTO care_map_schema_migrations(filename,checksum) VALUES($1,$2)",
        [file.filename,file.checksum]
      );
      appliedNow++;
    }
    const ext=await client.query<{version:string}>("SELECT postgis_lib_version() version");
    return{
      ok:true,migrations:files.length,appliedNow,skipped,
      postgisVersion:ext.rows[0]?.version||null
    };
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
  let migrations:MigrationStatus={
    historyAvailable:false,expected:migrationFiles().length,applied:0,
    pending:migrationFiles().map(x=>x.filename),checksumMismatches:[],latestAppliedAt:null
  };
  let data:DataReadiness={
    lgaBoundaries:0,totalLgas:23,pilotBoundaries:0,pilotLgas:14,verifiedRivers:0,verifiedSettlements:0,
    boreholes:0,assets:0,verifiedHazardZones:0,verifiedCatchments:0,pilotAcceptanceTested:0,pilotAcceptancePassed:0,admins:0
  };

  if(databaseUrl){
    database=await checkDatabase({databaseUrl,caCert:process.env.AIVEN_CA_CERT});
    if(database.ok){
      const client=new pg.Client({
        connectionString:databaseUrl,
        ssl:ssl(process.env.AIVEN_CA_CERT),
        connectionTimeoutMillis:10000
      });
      try{
        await client.connect();
        migrations=await migrationStatusOnClient(client);

        const tableCheck=await client.query<{
          lgas:boolean;lgaBoundary:boolean;rivers:boolean;settlements:boolean;boreholes:boolean;assets:boolean;
          hazards:boolean;catchments:boolean;acceptance:boolean;users:boolean;
        }>(`
          SELECT
            to_regclass('public.lgas') IS NOT NULL lgas,
            EXISTS(
              SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='lgas' AND column_name='boundary'
            ) "lgaBoundary",
            to_regclass('public.rivers') IS NOT NULL rivers,
            to_regclass('public.settlements') IS NOT NULL settlements,
            to_regclass('public.boreholes') IS NOT NULL boreholes,
            to_regclass('public.assets') IS NOT NULL assets,
            to_regclass('public.hazard_zones') IS NOT NULL hazards,
            to_regclass('public.catchments') IS NOT NULL catchments,
            to_regclass('public.field_acceptance_runs') IS NOT NULL acceptance,
            to_regclass('public.users') IS NOT NULL users
        `);
        const t=tableCheck.rows[0];
        const count=async(sql:string)=>Number((await client.query<{n:string}>(sql)).rows[0]?.n||0);
        data={
          lgaBoundaries:t?.lgas&&t?.lgaBoundary?await count("SELECT count(*) n FROM lgas WHERE boundary IS NOT NULL"):0,
          totalLgas:t?.lgas?await count("SELECT count(*) n FROM lgas"):23,
          pilotBoundaries:t?.lgas&&t?.lgaBoundary?await count("SELECT count(*) n FROM lgas WHERE pilot=TRUE AND boundary IS NOT NULL"):0,
          pilotLgas:t?.lgas?await count("SELECT count(*) n FROM lgas WHERE pilot=TRUE"):14,
          verifiedRivers:t?.rivers?await count("SELECT count(*) n FROM rivers WHERE verified"):0,
          verifiedSettlements:t?.settlements?await count("SELECT count(*) n FROM settlements WHERE verified"):0,
          boreholes:t?.boreholes?await count("SELECT count(*) n FROM boreholes"):0,
          assets:t?.assets?await count("SELECT count(*) n FROM assets"):0,
          verifiedHazardZones:t?.hazards?await count("SELECT count(*) n FROM hazard_zones WHERE verified"):0,
          verifiedCatchments:t?.catchments?await count("SELECT count(*) n FROM catchments WHERE verified"):0,
          pilotAcceptanceTested:t?.acceptance?await count(`
            SELECT count(*) n FROM (
              SELECT DISTINCT ON (r.lga_code) r.lga_code,r.result
              FROM field_acceptance_runs r
              JOIN lgas l ON l.code=r.lga_code
              WHERE l.pilot=TRUE AND r.status='completed'
              ORDER BY r.lga_code,r.completed_at DESC,r.id DESC
            ) latest
          `):0,
          pilotAcceptancePassed:t?.acceptance?await count(`
            SELECT count(*) n FROM (
              SELECT DISTINCT ON (r.lga_code) r.lga_code,r.result
              FROM field_acceptance_runs r
              JOIN lgas l ON l.code=r.lga_code
              WHERE l.pilot=TRUE AND r.status='completed'
              ORDER BY r.lga_code,r.completed_at DESC,r.id DESC
            ) latest
            WHERE result='pass'
          `):0,
          admins:t?.users?await count("SELECT count(*) n FROM users WHERE role='admin' AND active=TRUE AND deleted_at IS NULL"):0
        };
      }catch{
        // The database health result already captures connectivity. Missing readiness details stay zeroed.
      }finally{
        await client.end().catch(()=>{});
      }
    }
  }

  const databaseReady=Boolean(database.ok&&database.postgisEnabled);
  const migrationDrift=migrations.checksumMismatches.length>0;
  const migrationsReady=migrations.historyAvailable&&migrations.pending.length===0&&!migrationDrift;

  const items:ReadinessItem[]=[
    {
      id:"database",label:"Aiven PostgreSQL reachable",category:"infrastructure",
      state:database.ok?"ready":"blocked",required:true,
      detail:database.ok?"Database connection succeeds.":database.error||"DATABASE_URL is not configured.",
      action:"Configure DATABASE_URL and AIVEN_CA_CERT, then test the Aiven connection."
    },
    {
      id:"aiven-ca",label:"Aiven TLS certificate verification",category:"security",
      state:process.env.AIVEN_CA_CERT?"ready":"blocked",required:true,
      detail:process.env.AIVEN_CA_CERT?"Aiven CA certificate is configured.":"AIVEN_CA_CERT is missing; database TLS cannot be strictly verified.",
      action:"Add the Aiven CA certificate as AIVEN_CA_CERT in Vercel."
    },
    {
      id:"postgis",label:"PostGIS enabled",category:"database",
      state:databaseReady?"ready":"blocked",required:true,
      detail:database.postgisEnabled?"PostGIS "+(database.postgisVersion||"enabled")+".":"Spatial extension is unavailable.",
      action:"Run Initialize / upgrade schema against the Aiven database."
    },
    {
      id:"migrations",label:"Database migrations current",category:"database",
      state:migrationDrift?"blocked":migrationsReady?"ready":database.ok?"warning":"blocked",required:true,
      detail:migrationDrift
        ?"Checksum drift detected: "+migrations.checksumMismatches.join(", ")
        :migrationsReady
          ?migrations.applied+" of "+migrations.expected+" migrations recorded."
          :migrations.historyAvailable
            ?migrations.pending.length+" migration(s) pending."
            :"Migration ledger is not initialized yet.",
      action:migrationDrift
        ?"Restore historical migration files to their applied contents and add changes as a new migration."
        :"Run Initialize / upgrade schema to apply and record pending migrations."
    },
    {
      id:"session-secret",label:"Session signing secret",category:"security",
      state:process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32?"ready":"blocked",required:true,
      detail:"SESSION_SECRET must be at least 32 characters.",
      action:"Store a strong SESSION_SECRET in Vercel environment variables."
    },
    {
      id:"cron-secret",label:"Scheduled-job secret",category:"security",
      state:process.env.CRON_SECRET&&process.env.CRON_SECRET.length>=24?"ready":"blocked",required:true,
      detail:"CRON_SECRET protects scheduled risk and monitoring jobs.",
      action:"Store a strong CRON_SECRET in Vercel environment variables."
    },
    {
      id:"admin",label:"Active administrator",category:"operations",
      state:data.admins>0?"ready":database.ok?"blocked":"blocked",required:true,
      detail:data.admins+" active administrator account(s).",
      action:"Use Administrator bootstrap to create or rotate the first admin account."
    },
    {
      id:"pilot-boundaries",label:"Pilot LGA boundaries",category:"data",
      state:data.pilotLgas>0&&data.pilotBoundaries===data.pilotLgas?"ready":data.pilotBoundaries>0?"warning":"blocked",required:true,
      detail:data.pilotBoundaries+" of "+data.pilotLgas+" pilot LGA boundaries loaded.",
      action:"Import project-approved boundaries for every pilot LGA before field rollout."
    },
    {
      id:"statewide-boundaries",label:"Statewide LGA boundary coverage",category:"data",
      state:data.totalLgas>0&&data.lgaBoundaries===data.totalLgas?"ready":"warning",required:false,
      detail:data.lgaBoundaries+" of "+data.totalLgas+" Benue LGA boundaries loaded.",
      action:"Load all 23 approved LGA boundaries before statewide public reporting."
    },
    {
      id:"interventions",label:"Baseline intervention data",category:"data",
      state:(data.boreholes+data.assets)>0?"ready":"warning",required:true,
      detail:data.boreholes+" boreholes and "+data.assets+" assets mapped.",
      action:"Import or collect verified intervention coordinates before operational launch."
    },
    {
      id:"field-acceptance",label:"Pilot field acceptance",category:"operations",
      state:data.pilotLgas>0&&data.pilotAcceptancePassed===data.pilotLgas
        ?"ready"
        :data.pilotAcceptanceTested>0?"warning":"blocked",
      required:true,
      detail:data.pilotAcceptancePassed+" of "+data.pilotLgas+" pilot LGAs have a passing latest completed field acceptance run; "+data.pilotAcceptanceTested+" have any completed run.",
      action:"Run the Field Acceptance Test Center on target devices in each pilot LGA and resolve every required failed/blocked check."
    },
    {
      id:"settlements",label:"Verified settlement inventory",category:"data",
      state:data.verifiedSettlements>0?"ready":"warning",required:false,
      detail:data.verifiedSettlements+" verified settlements available.",
      action:"Import and verify a GIS/M&E-approved settlement inventory for access analysis."
    },
    {
      id:"rivers",label:"Verified river geometry",category:"data",
      state:data.verifiedRivers>0?"ready":"warning",required:false,
      detail:data.verifiedRivers+" verified river records available.",
      action:"Verify river geometry before using river-corridor analysis operationally."
    },
    {
      id:"hazards",label:"Verified hazard polygons",category:"data",
      state:data.verifiedHazardZones>0?"ready":"warning",required:false,
      detail:data.verifiedHazardZones+" verified hazard zones available.",
      action:"Import source-backed hazard polygons and verify them before hazard exposure analysis."
    },
    {
      id:"catchments",label:"Verified catchments",category:"data",
      state:data.verifiedCatchments>0?"ready":"warning",required:false,
      detail:data.verifiedCatchments+" verified catchments available.",
      action:"Import verified watershed/catchment boundaries for landscape planning."
    },
    {
      id:"photos",label:"Field photo storage",category:"infrastructure",
      state:process.env.BLOB_READ_WRITE_TOKEN?"ready":"warning",required:false,
      detail:process.env.BLOB_READ_WRITE_TOKEN?"Vercel Blob is configured.":"Evidence-photo storage is not configured.",
      action:"Add BLOB_READ_WRITE_TOKEN before field evidence/photo workflows."
    },
    {
      id:"remote-sensing",label:"Copernicus processing",category:"infrastructure",
      state:process.env.CDSE_CLIENT_ID&&process.env.CDSE_CLIENT_SECRET?"ready":"warning",required:false,
      detail:process.env.CDSE_CLIENT_ID&&process.env.CDSE_CLIENT_SECRET?"Copernicus OAuth is configured.":"Scene discovery works, but NDVI processing credentials are missing.",
      action:"Add CDSE_CLIENT_ID and CDSE_CLIENT_SECRET to enable Sentinel processing."
    }
  ];

  return{
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||"unknown",
    databaseConfigured:Boolean(databaseUrl),
    caConfigured:Boolean(process.env.AIVEN_CA_CERT),
    sessionSecretConfigured:Boolean(process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32),
    cronSecretConfigured:Boolean(process.env.CRON_SECRET&&process.env.CRON_SECRET.length>=24),
    blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    remoteSensingConfigured:Boolean(process.env.CDSE_CLIENT_ID&&process.env.CDSE_CLIENT_SECRET),
    adminSeedConfigured:Boolean(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD),
    databaseHost:details?.host||null,databaseName:details?.database||null,database,
    migrations,data,readinessItems:items,readiness:readinessSummary(items)
  };
}
