import {Pool,type QueryResultRow} from "pg";
import {postgresTlsOptions,safePostgresUri} from "@/lib/database-tls";
declare global{var __careMapPool:Pool|undefined;}
function createPool(){
 const connectionString=process.env.DATABASE_URL;
 if(!connectionString) throw new Error("DATABASE_URL is not configured");
 const ssl=postgresTlsOptions(connectionString,process.env.AIVEN_CA_CERT);
 return new Pool({
  connectionString:safePostgresUri(connectionString),
  max:1,min:0,idleTimeoutMillis:1500,connectionTimeoutMillis:8000,
  statement_timeout:12_000,query_timeout:15_000,
  application_name:"care-map",allowExitOnIdle:true,ssl
 });
}
export function pool(){if(!global.__careMapPool) global.__careMapPool=createPool();return global.__careMapPool;}
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){return pool().query<T>(text,params);}
