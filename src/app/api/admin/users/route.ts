import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {userCreateSchema} from "@/lib/validators";
import {parseWorkspaceAccess,DEFAULT_STAFF_WORKSPACES} from "@/lib/workspaces";
export const runtime="nodejs";
export const dynamic="force-dynamic";

function code(e:unknown){
 return e&&typeof e==="object"&&"code" in e?String(e.code):"UNAVAILABLE";
}
export async function GET(){
 const session=await getSession();
 if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
 try{
  const result=await query(
   "SELECT id,email,name,role,active,created_at,last_login_at,disabled_reason,workspace_access FROM users WHERE deleted_at IS NULL ORDER BY active DESC,role,name"
  );
  return NextResponse.json({data:result.rows,workspaceSchemaReady:true});
 }catch(e){
  if(code(e)!=="42703"){
   console.error("Admin user listing failed",{code:code(e)});
   return error("Unable to load user accounts.",503,"ADMIN_USERS_UNAVAILABLE");
  }
  // Existing admins must remain able to reach the migration manager before
  // 003 or 022 has been applied. Permissions cannot be edited yet.
  try{
   const previous=await query(
    "SELECT id,email,name,role,active,created_at FROM users WHERE deleted_at IS NULL ORDER BY active DESC,role,name"
   );
   return NextResponse.json({
    data:previous.rows.map(row=>({...row,last_login_at:null,disabled_reason:null,
      workspace_access:row.role==="staff"?DEFAULT_STAFF_WORKSPACES:[]})),
    workspaceSchemaReady:false
   });
  }catch(inner){
   console.error("Admin user listing unavailable",{code:code(inner)});
   return error("Apply the initial database schema before managing users.",503,"SCHEMA_PENDING");
  }
 }
}

export async function POST(request:Request){
 const session=await getSession();
 if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return error("Invalid request origin.",403,"INVALID_ORIGIN");
 const parsed=userCreateSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return error("Invalid user details",400);
 const data=parsed.data;
 const staff=data.role==="staff";
 const access=staff?parseWorkspaceAccess(data.workspaceAccess??DEFAULT_STAFF_WORKSPACES):[];
 if(staff&&!access)return error("Choose at least one valid staff workspace.",400,"INVALID_WORKSPACES");
 const hash=await bcrypt.hash(data.password,12);
 const client=await pool().connect();
 try{
  await client.query("BEGIN");
  const inserted=staff
   ?await client.query(
      "INSERT INTO users(email,password_hash,name,role,workspace_access) VALUES($1,$2,$3,$4,$5::text[]) RETURNING id,email,name,role,active,workspace_access",
      [data.email,hash,data.name,data.role,access]
    )
   :await client.query(
      "INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role,active",
      [data.email,hash,data.name,data.role]
    );
  await client.query(
   "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create','user',$2,$3)",
   [session.sub,inserted.rows[0].id,JSON.stringify({role:data.role,workspaces:access})]
  );
  await client.query("COMMIT");
  return NextResponse.json({data:inserted.rows[0]},{status:201});
 }catch(e){
  await client.query("ROLLBACK").catch(()=>{});
  const state=code(e);
  if(state==="42703")return error(
   "Apply migration 022 from Admin → Database migrations before assigning staff interfaces.",
   503,"WORKSPACE_SCHEMA_PENDING"
  );
  if(state==="23505")return error("That email address already has an account.",409,"DUPLICATE_EMAIL");
  console.error("Admin account creation failed",{code:state});
  return error("Unable to create the account. Check database availability.",500,"USER_CREATE_FAILED");
 }finally{
  client.release();
 }
}
