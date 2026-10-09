import {Pool,type QueryResultRow} from "pg";
declare global{var __careMapPool:Pool|undefined;}
function createPool(){
 const connectionString=process.env.DATABASE_URL;
 if(!connectionString) throw new Error("DATABASE_URL is not configured");
 const ca=process.env.AIVEN_CA_CERT?.replace(/\\n/g,"\n");
 const uri=new URL(connectionString);uri.searchParams.delete("sslmode");uri.searchParams.delete("sslrootcert");uri.searchParams.delete("sslcert");uri.searchParams.delete("sslkey");
 return new Pool({connectionString:uri.toString(),max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,ssl:ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:false}});
}
export function pool(){if(!global.__careMapPool) global.__careMapPool=createPool();return global.__careMapPool;}
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){return pool().query<T>(text,params);}
