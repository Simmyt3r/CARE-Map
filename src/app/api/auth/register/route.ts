import bcrypt from "bcryptjs";
import {NextResponse} from "next/server";
import {pool} from "@/lib/db";
import {createSessionToken,setSessionCookie} from "@/lib/auth";
import {clientIp,error,rateLimit} from "@/lib/http";
import {registerSchema} from "@/lib/validators";

export const runtime="nodejs";

export async function POST(request:Request){
  const ip=clientIp(request);
  if(!rateLimit("register:"+ip,5,60*60_000))return error("Too many registrations",429,"RATE_LIMITED");

  const parsed=registerSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return error("Invalid registration details or privacy acknowledgement",400);

  const hash=await bcrypt.hash(parsed.data.password,12);
  const client=await pool().connect();

  try{
    await client.query("BEGIN");
    const result=await client.query<{id:string}>(
      "INSERT INTO users(email,password_hash,name,role) VALUES($1,$2,$3,'registered_community') RETURNING id",
      [parsed.data.email,hash,parsed.data.name]
    );
    const id=result.rows[0].id;
    await client.query(
      "INSERT INTO privacy_notice_acceptances(user_id,context,notice_version) VALUES($1,'registration',$2)",
      [id,parsed.data.privacyNoticeVersion]
    );
    await client.query("COMMIT");

    const token=await createSessionToken({
      sub:id,email:parsed.data.email,name:parsed.data.name,role:"registered_community"
    });
    await setSessionCookie(token);
    return NextResponse.json({ok:true},{status:201});
  }catch{
    await client.query("ROLLBACK").catch(()=>{});
    return error("An account with that email may already exist",409,"ACCOUNT_EXISTS");
  }finally{
    client.release();
  }
}
