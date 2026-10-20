import {NextResponse} from "next/server";
import {z} from "zod";
import {getSession,isAdmin} from "@/lib/auth";
import {query} from "@/lib/db";
import {crfAudit,crfTransaction,CRF_ROLES} from "@/lib/crf";
import {error} from "@/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";

const command=z.object({
 action:z.enum(["grant","revoke"]),
 userId:z.string().uuid(),
 role:z.enum(CRF_ROLES)
});
export async function GET(){
 const actor=await getSession();
 if(!isAdmin(actor))return error("Administrator access required.",403,"FORBIDDEN");
 try{
  const roles=await query(`SELECT a.user_id,u.name,u.email,a.crf_role,a.granted_at
    FROM crf_role_assignments a JOIN users u ON u.id=a.user_id ORDER BY u.name,a.crf_role LIMIT 300`);
  const users=await query(`SELECT id,name,email FROM users WHERE active=TRUE AND deleted_at IS NULL
    AND role IN ('staff','admin') ORDER BY name LIMIT 200`);
  return NextResponse.json({data:{roles:roles.rows,users:users.rows}},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return error("CRF access records unavailable. Administrator must first apply migration 019.",503,"SCHEMA_PENDING");
 }
}
export async function POST(request:Request){
 const actor=await getSession();
 if(!isAdmin(actor))return error("Administrator access required.",403,"FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const raw=await request.text();
 if(raw.length>2000)return error("Request too large.",413);
 const parsed=command.safeParse((()=>{try{return JSON.parse(raw);}catch{return null;}})());
 if(!parsed.success)return error("Invalid CRF access command.",400);
 const {action,userId,role}=parsed.data;
 try{
  const result=await crfTransaction(async tx=>{
   const user=await tx.query(`SELECT id FROM users WHERE id=$1 AND active=TRUE AND deleted_at IS NULL
       AND role IN ('staff','admin')`,[userId]);
   if(!user.rowCount)throw new Error("Target staff account is unavailable.");
   if(action==="grant"){
    await tx.query(`INSERT INTO crf_role_assignments(user_id,crf_role,granted_by)
        VALUES($1,$2,$3) ON CONFLICT(user_id,crf_role) DO NOTHING`,[userId,role,actor.sub]);
   }else{
    await tx.query("DELETE FROM crf_role_assignments WHERE user_id=$1 AND crf_role=$2",[userId,role]);
   }
   await crfAudit(tx,actor.sub,action+"_crf_role","user",userId,{role});
   return {ok:true};
  });
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return error(e instanceof Error&&e.message==="Target staff account is unavailable."?e.message:
    "CRF role update failed.",409);
 }
}
