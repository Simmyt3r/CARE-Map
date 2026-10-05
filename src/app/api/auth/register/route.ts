import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {createSessionToken,setSessionCookie} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {registerSchema} from "@/lib/validators";
export const runtime="nodejs";
export async function POST(request:Request){
 const ip=clientIp(request);if(!rateLimit("register:"+ip,5,60*60_000))return error("Too many registrations",429,"RATE_LIMITED");
 const parsed=registerSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return error("Invalid registration details",400);
 const hash=await bcrypt.hash(parsed.data.password,12);
 try{
  const result=await query<{id:string}>("INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,'registered_community') RETURNING id",[parsed.data.email,hash,parsed.data.name]);
  const token=await createSessionToken({sub:result.rows[0].id,email:parsed.data.email,name:parsed.data.name,role:"registered_community"});await setSessionCookie(token);
  return NextResponse.json({ok:true},{status:201});
 }catch{return error("An account with that email may already exist",409,"ACCOUNT_EXISTS");}
}
