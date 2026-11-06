import {query} from "@/lib/db";
import type {Session} from "@/lib/auth";
import {
 ALL_WORKSPACE_IDS,DEFAULT_STAFF_WORKSPACES,parseWorkspaceAccess,type WorkspaceId
} from "@/lib/workspaces";

/** DB is authoritative; signing out or changing a role revokes access immediately. */
export async function loadWorkspaceAccess(session:Session|null):Promise<WorkspaceId[]>{
 if(!session)return [];
 if(session.role==="admin")return ALL_WORKSPACE_IDS;
 if(session.role!=="staff")return [];
 try{
  const result=await query<{workspace_access:string[]}>(
   "SELECT workspace_access FROM users WHERE id=$1 AND role='staff' AND active=TRUE AND deleted_at IS NULL",
   [session.sub]
  );
  if(!result.rows.length)return [];
  return parseWorkspaceAccess(result.rows[0].workspace_access)||[];
 }catch(e){
  // Rollout safety: accounts with migration 001 but not 022 may continue
  // using only the narrow field/report starter roles until admin upgrades.
  const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";
  if(code==="42703")return DEFAULT_STAFF_WORKSPACES;
  throw e;
 }
}
