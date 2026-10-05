import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {createSessionToken,setSessionCookie} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {loginSchema} from "@/lib/validators";
export const runtime="nodejs";
export async function POST(request:Request){
 const ip=clientIp(request);if(!rateLimit("login:"+ip,10,15*60_000))return error("Too many login attempts",429,"RATE_LIMITED");
 const parsed=loginSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return error("Invalid email or password",400);
 const result=await query<{id:string;email:string;name:string;role:"registered_community"|"staff"|"admin";password_hash:string}>("SELECT id,email,name,role,password_hash FROM users WHERE email=$1 AND active=TRUE AND deleted_at IS NULL",[parsed.data.email]);
 const user=result.rows[0];if(!user||!(await bcrypt.compare(parsed.data.password,user.password_hash)))return error("Invalid email or password",401,"INVALID_CREDENTIALS");
 const token=await createSessionToken({sub:user.id,email:user.email,name:user.name,role:user.role});await setSessionCookie(token);
 return NextResponse.json({user:{id:user.id,email:user.email,name:user.name,role:user.role}});
}
