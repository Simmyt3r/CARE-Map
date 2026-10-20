import {pool,query} from "@/lib/db";
import type {PoolClient} from "pg";
import type {Session} from "@/lib/auth";

export const CRF_ROLES=["desk_officer","me_officer","gis_officer","finance_officer","internal_auditor","management"] as const;
export type CrfRole=typeof CRF_ROLES[number];
export type CrfAccess={userId:string;roles:CrfRole[]};
export type CrfPolicy={recoveryMinimum:number;par60Maximum:number;womenMemberMinimum:number;womenValueMinimum:number;membersPerCig:number};
export const CRF_POLICY:CrfPolicy={
 recoveryMinimum:75,par60Maximum:25,womenMemberMinimum:40,womenValueMinimum:30,membersPerCig:15
};
export function canCrf(roles:readonly CrfRole[],permission:"view"|"registry"|"finance"|"verify"|"report"|"field"){
 const allowed:Record<typeof permission,CrfRole[]>={
   view:[...CRF_ROLES],
   registry:["desk_officer","management"],
   finance:["finance_officer","desk_officer"],
   verify:["finance_officer","internal_auditor"],
   report:["desk_officer","me_officer","internal_auditor","finance_officer","management"],
   field:["gis_officer","me_officer","desk_officer"]
 };
 return roles.some(role=>allowed[permission].includes(role));
}
/** Administrator status does not automatically confer confidential CRF access. */
export async function crfAccess(session:Session|null):Promise<CrfAccess|null>{
 if(!session||session.role==="registered_community")return null;
 const rs=await query<{crf_role:CrfRole}>(
   "SELECT crf_role FROM crf_role_assignments WHERE user_id=$1 ORDER BY crf_role",[session.sub]);
 return rs.rows.length?{userId:session.sub,roles:rs.rows.map(r=>r.crf_role)}:null;
}
export async function crfTransaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
 const client=await pool().connect();
 try{
  await client.query("BEGIN");
  const result=await work(client);
  await client.query("COMMIT");
  return result;
 }catch(e){
  await client.query("ROLLBACK").catch(()=>{});
  throw e;
 }finally{client.release();}
}
export async function crfAudit(client:PoolClient,actor:string,event:string,entity:string,id:string,details:Record<string,unknown>={}){
 await client.query("INSERT INTO crf_activity_audit(actor_id,event_type,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5::jsonb)",
   [actor,event,entity,id,JSON.stringify(details)]);
}
export function flatServiceCharge(tenor:3|6|12){
 return tenor===3?50000:tenor===6?75000:100000;
}
export function roundNairaCents(value:number){
 return Math.round((value+Number.EPSILON)*100)/100;
}
export function trancheAmount(principal:number,tranche:1|2){
 const first=roundNairaCents(principal*0.7);
 return tranche===1?first:roundNairaCents(principal-first);
}
export type RecoveryInputs={
 dueInPeriod:number;recoveredInPeriod:number;
 outstandingTotal:number;outstandingAtRisk60:number;
 verifiedDisbursedTotal:number;womenLedDisbursed:number;
};
export function crfIndicators(v:RecoveryInputs){
 const pct=(num:number,den:number)=>den>0?roundNairaCents(100*num/den):null;
 return{
  recoveryPercent:pct(v.recoveredInPeriod,v.dueInPeriod),
  par60Percent:pct(v.outstandingAtRisk60,v.outstandingTotal),
  womenFundPercent:pct(v.womenLedDisbursed,v.verifiedDisbursedTotal),
  amounts:{...v},
  sourceNote:"Verified bank transactions only; FIFO allocation to oldest instalment assumed for PAR60. Review bank reconciliation and schedule corrections before official submission."
 };
}
export function assessGroup(members:{sex:string;participation_verified:boolean}[]){
 const female=members.filter(m=>m.sex==="female").length;
 const verified=members.every(m=>m.participation_verified===true);
 return{
  count:members.length,female,
  femalePercent:members.length?100*female/members.length:0,
  ready:members.length===CRF_POLICY.membersPerCig&&female>=6&&verified
 };
}
