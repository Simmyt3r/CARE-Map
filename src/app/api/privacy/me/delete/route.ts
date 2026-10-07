import {NextResponse} from "next/server";
import {clearSessionCookie,getSession} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return error("Sign in required.",401,"UNAUTHENTICATED");
  if(session.role!=="registered_community")return error("Only community accounts can use self-service account erasure.",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {confirmation?:string}|null;
  if(String(body?.confirmation||"").trim().toUpperCase()!=="DELETE"){
    return error("Type DELETE to confirm account erasure.");
  }

  const client=await pool().connect();
  try{
    await client.query("BEGIN");

    await client.query(
      "UPDATE reports SET reporter_name=NULL,reporter_contact=NULL WHERE submitted_by=$1",
      [session.sub]
    );

    const anonymizedEmail="deleted+"+session.sub+"@caremap.invalid";
    const updated=await client.query(`
      UPDATE users SET
        email=$2,
        name='Deleted community user',
        password_hash='ERASED',
        active=FALSE,
        deleted_at=COALESCE(deleted_at,now()),
        disabled_reason='User-requested account erasure'
      WHERE id=$1 AND role='registered_community'
      RETURNING id
    `,[session.sub,anonymizedEmail]);

    if(!updated.rowCount){
      await client.query("ROLLBACK");
      return error("Community account not found.",404);
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES(NULL,'community_account_erasure','user',$1,$2)",
      [session.sub,JSON.stringify({method:"self_service",reportsIdentityFieldsCleared:true})]
    );

    await client.query("COMMIT");
    await clearSessionCookie();

    return NextResponse.json({
      ok:true,
      message:"Your community account identity has been anonymized and optional reporter identity/contact fields on linked reports have been removed. Operational report records may be retained in de-identified form where required for project tracking."
    });
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Account erasure failed.",400);
  }finally{
    client.release();
  }
}
