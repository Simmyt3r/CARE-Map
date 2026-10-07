"use server";
import {getSession,isAdmin} from "@/lib/auth";
import {bootstrapAdmin,checkDatabase,initializeDatabase,type AivenConfig} from "@/lib/infrastructure";

export type InfraActionResult={ok:boolean;message:string;details?:Record<string,string|number|boolean|null|undefined>};

async function requireAdmin(){
  const session=await getSession();
  if(!isAdmin(session))throw new Error("Administrator access required.");
}

function clean(input:{databaseUrl:string;caCert?:string}):AivenConfig{
  return{databaseUrl:String(input.databaseUrl||"").trim(),caCert:String(input.caCert||"").trim()||undefined};
}

export async function testAivenAction(input:{databaseUrl:string;caCert?:string}):Promise<InfraActionResult>{
  await requireAdmin();
  const check=await checkDatabase(clean(input));
  if(!check.ok)return{ok:false,message:check.error||"Connection failed."};
  return{ok:true,message:"Aiven PostgreSQL connection is healthy.",details:{
    host:check.host,database:check.database,user:check.user,postgresVersion:check.postgresVersion,
    postgisEnabled:Boolean(check.postgisEnabled),postgisVersion:check.postgisVersion,tables:check.tables
  }};
}

export async function initializeAivenAction(input:{databaseUrl:string;caCert?:string}):Promise<InfraActionResult>{
  await requireAdmin();
  try{
    const result=await initializeDatabase(clean(input));
    return{ok:true,message:"PostGIS and CARE-Map schema initialized successfully.",details:{migrations:result.migrations,appliedNow:result.appliedNow,skipped:result.skipped,postgisVersion:result.postgisVersion}};
  }catch(e){
    return{ok:false,message:e instanceof Error?e.message:"Database initialization failed."};
  }
}

export async function bootstrapAdminAction(input:{databaseUrl:string;caCert?:string;email:string;password:string;name?:string}):Promise<InfraActionResult>{
  await requireAdmin();
  try{
    const result=await bootstrapAdmin(clean(input),String(input.email||"").trim(),String(input.password||""),String(input.name||"").trim()||"CARE-Map Administrator");
    return{ok:true,message:"Administrator account created or rotated.",details:{email:result.email,id:result.id}};
  }catch(e){
    return{ok:false,message:e instanceof Error?e.message:"Administrator bootstrap failed."};
  }
}
