import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {validateTranslationMap} from "@/lib/i18n";

export async function PATCH(request:Request,context:{params:Promise<{code:string}>}){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const{code}=await context.params;
  if(!["tiv","idoma","igede"].includes(code))return error("Unsupported translation language.");

  const body=await request.json().catch(()=>null) as {action?:string}|null;
  const action=String(body?.action||"").trim();
  if(!["review","enable","disable","revoke"].includes(action))return error("Invalid translation-pack action.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const current=await client.query<{translations:Record<string,string>;status:string;enabled:boolean}>(
      "SELECT translations,status,enabled FROM translation_packs WHERE language_code=$1 FOR UPDATE",
      [code]
    );
    if(!current.rowCount){await client.query("ROLLBACK");return error("Translation pack not found.",404);}

    const pack=current.rows[0];
    const check=validateTranslationMap(pack.translations);

    if(action==="review"){
      if(check.coverage!==100)return error("A translation pack must cover 100% of required public keys before review approval.");
      await client.query(`
        UPDATE translation_packs
        SET status='reviewed',reviewed_by=$2,reviewed_at=now(),updated_by=$2
        WHERE language_code=$1
      `,[code,session.sub]);
    }else if(action==="enable"){
      if(pack.status!=="reviewed")return error("Review the translation pack before enabling it.");
      await client.query("UPDATE translation_packs SET enabled=TRUE,updated_by=$2 WHERE language_code=$1",[code,session.sub]);
    }else if(action==="disable"){
      await client.query("UPDATE translation_packs SET enabled=FALSE,updated_by=$2 WHERE language_code=$1",[code,session.sub]);
    }else{
      await client.query(`
        UPDATE translation_packs
        SET status='draft',enabled=FALSE,reviewed_by=NULL,reviewed_at=NULL,updated_by=$2
        WHERE language_code=$1
      `,[code,session.sub]);
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'translation_pack_"+action+"','translation_pack',$2)",
      [session.sub,JSON.stringify({languageCode:code,coverage:check.coverage})]
    );
    await client.query("COMMIT");

    return NextResponse.json({data:{languageCode:code,action,coverage:check.coverage}});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Translation pack update failed.",400);
  }finally{
    client.release();
  }
}
