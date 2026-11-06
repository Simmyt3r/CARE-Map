import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {pool} from "@/lib/db";
import {error} from "@/lib/http";
import {parseWorkspaceAccess} from "@/lib/workspaces";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function code(e:unknown){
 return e&&typeof e==="object"&&"code" in e?String(e.code):"UNAVAILABLE";
}

/** All changes to staff interface roles require a live admin session. */
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 const actor=await getSession();
 if(!isAdmin(actor))return error("Administrator access required.",403,"FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const {id}=await context.params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return error("Invalid account ID.",400);
 const body=await request.json().catch(()=>null);
 const selected=parseWorkspaceAccess(body?.workspaceAccess);
 if(!selected)return error("Assign at least one recognized workspace.",400,"INVALID_WORKSPACES");
 const tx=await pool().connect();
 try{
  await tx.query("BEGIN");
  const target=await tx.query<{role:string}>(
    "SELECT role FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[id]
  );
  if(!target.rows.length){
   await tx.query("ROLLBACK");
   return error("Account not found.",404,"NOT_FOUND");
  }
  if(target.rows[0].role!=="staff"){
   await tx.query("ROLLBACK");
   return error("Only staff accounts have assignable workspace roles. Administrators already have full access.",400);
  }
  const updated=await tx.query<{id:string;workspace_access:string[]}>(
    "UPDATE users SET workspace_access=$2::text[] WHERE id=$1 RETURNING id,workspace_access",
    [id,selected]
  );
  await tx.query(
   "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'workspace_access_update','user',$2,$3)",
   [actor.sub,id,JSON.stringify({workspaces:selected})]
  );
  await tx.query("COMMIT");
  return NextResponse.json({data:updated.rows[0]},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  await tx.query("ROLLBACK").catch(()=>{});
  const state=code(e);
  console.error("Staff workspace assignment failed",{code:state});
  return error(state==="42703"?
   "Apply migration 022 in the administrator migration panel first.":
   "Unable to update assigned interfaces.",state==="42703"?503:500,
   state==="42703"?"WORKSPACE_SCHEMA_PENDING":"WORKSPACE_UPDATE_FAILED");
 }finally{
  tx.release();
 }
}
