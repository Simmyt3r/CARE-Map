import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {updateAdminAccount,type AdminAccountChange} from "@/lib/admin-users";

const roles=new Set(["registered_community","staff","admin"]);

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
  const{id}=await context.params;
  const body=await request.json().catch(()=>null) as AdminAccountChange|null;
  if(!body||typeof body!=="object"||Array.isArray(body))return error("Invalid request body.");
  if(body.role!==undefined&&(typeof body.role!=="string"||!roles.has(body.role)))return error("Invalid role.");
  if(body.active!==undefined&&typeof body.active!=="boolean")return error("Invalid active status.");
  if(body.disabledReason!==undefined&&body.disabledReason!==null&&typeof body.disabledReason!=="string")
    return error("Invalid disabled reason.");

  const client=await pool().connect();
  try{
    const outcome=await updateAdminAccount(client,session.sub,id,body);
    if(!outcome.ok)return error(outcome.message,outcome.status,outcome.status===403?"FORBIDDEN":"BAD_REQUEST");
    return NextResponse.json({data:outcome.user},{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    const code=e&&typeof e==="object"&&"code" in e?String(e.code):"UNKNOWN";
    console.error("Admin account update failed",{code});
    return error("Account update failed. Please try again.",500,"ACCOUNT_UPDATE_FAILED");
  }finally{
    client.release();
  }
}
