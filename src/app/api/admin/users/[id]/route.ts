import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const roles=new Set(["registered_community","staff","admin"]);

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as {role?:string;active?:boolean;disabledReason?:string|null}|null;
  if(!body)return error("Invalid request body.");

  if(id===session.sub&&(body.active===false||body.role&&body.role!=="admin")){
    return error("You cannot disable or demote your own administrator account.",400);
  }

  const current=await query<{role:string;active:boolean}>("SELECT role,active FROM users WHERE id=$1 AND deleted_at IS NULL",[id]);
  if(!current.rowCount)return error("User not found",404);

  if((current.rows[0].role==="admin")&&(body.active===false||(body.role&&body.role!=="admin"))){
    const admins=await query<{count:string}>("SELECT count(*)::text count FROM users WHERE role='admin' AND active=TRUE AND deleted_at IS NULL");
    if(Number(admins.rows[0]?.count||0)<=1)return error("At least one active administrator must remain.",400);
  }

  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};

  if(body.role!==undefined){
    if(!roles.has(body.role))return error("Invalid role.");
    params.push(body.role);sets.push("role=$"+params.length);metadata.role=body.role;
  }
  if(body.active!==undefined){
    params.push(body.active);sets.push("active=$"+params.length);metadata.active=body.active;
    if(body.active){sets.push("disabled_reason=NULL");}
  }
  if(body.disabledReason!==undefined&&body.active!==true){
    params.push(body.disabledReason?.trim().slice(0,500)||null);sets.push("disabled_reason=$"+params.length);metadata.disabledReason=body.disabledReason||null;
  }
  if(!sets.length)return error("Nothing to update.");

  params.push(id);
  const updated=await query("UPDATE users SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,email,name,role,active,last_login_at,disabled_reason",params);
  await query(
    "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'account_update','user',$2,$3)",
    [session.sub,id,JSON.stringify(metadata)]
  );
  return NextResponse.json({data:updated.rows[0]});
}
