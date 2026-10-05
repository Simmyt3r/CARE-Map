import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";
import {userCreateSchema} from "@/lib/validators";
export async function GET(){const session=await getSession();if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");const result=await query("SELECT id,email,name,role,active,created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC");return NextResponse.json({data:result.rows});}
export async function POST(request:Request){
 const session=await getSession();if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
 const parsed=userCreateSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return error("Invalid user details");const hash=await bcrypt.hash(parsed.data.password,12);
 try{const result=await query("INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role,active",[parsed.data.email,hash,parsed.data.name,parsed.data.role]);await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'create','user',$2)",[session.sub,result.rows[0].id]);return NextResponse.json({data:result.rows[0]},{status:201});}
 catch{return error("Unable to create user; email may already exist",409);}
}
