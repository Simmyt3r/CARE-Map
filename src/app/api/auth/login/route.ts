import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {createSessionToken,setSessionCookie} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {loginSchema} from "@/lib/validators";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type LoginUser={
  id:string;email:string;name:string;
  role:"registered_community"|"staff"|"admin";
  password_hash:string;
};
function databaseErrorCode(e:unknown):string{
  return e&&typeof e==="object"&&"code" in e?String(e.code):"UNAVAILABLE";
}

/**
 * Login is deliberately compatible with schema 001. Migration 003 adds
 * last_login_at, but administrators must be able to sign in before running
 * migration 003 through the protected admin migration manager.
 */
export async function POST(request:Request){
  const ip=clientIp(request);
  if(!rateLimit("login:"+ip,10,15*60_000))
    return error("Too many login attempts",429,"RATE_LIMITED");

  const parsed=loginSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return error("Invalid email or password",400);

  try{
    const result=await query<LoginUser>(
      "SELECT id,email,name,role,password_hash FROM users WHERE email=$1 AND active=TRUE AND deleted_at IS NULL",
      [parsed.data.email]
    );
    const user=result.rows[0];
    if(!user||!(await bcrypt.compare(parsed.data.password,user.password_hash)))
      return error("Invalid email or password",401,"INVALID_CREDENTIALS");

    try{
      await query("UPDATE users SET last_login_at=now() WHERE id=$1",[user.id]);
    }catch(e){
      // PostgreSQL undefined_column only: an *optional* audit timestamp must
      // never prevent an existing administrator from applying pending migrations.
      if(databaseErrorCode(e)!=="42703")throw e;
      console.warn("Login timestamp unavailable until migration 003 is applied",{code:"42703"});
    }

    const token=await createSessionToken({
      sub:user.id,email:user.email,name:user.name,role:user.role
    });
    await setSessionCookie(token);
    return NextResponse.json({
      user:{id:user.id,email:user.email,name:user.name,role:user.role}
    },{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    console.error("Login backend unavailable",{code:databaseErrorCode(e)});
    return error(
      "Sign-in is temporarily unavailable. Check the database connection, administrator setup and pending migrations.",
      503,"LOGIN_SERVICE_UNAVAILABLE"
    );
  }
}
