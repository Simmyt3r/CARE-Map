import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {targetLanguages,validateTranslationMap} from "@/lib/i18n";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const packs=await query(`
    SELECT p.language_code,p.language_name,p.native_name,p.translations,p.source,p.version,
      p.status,p.enabled,p.reviewed_at,p.updated_at,u.name reviewed_by_name
    FROM translation_packs p
    LEFT JOIN users u ON u.id=p.reviewed_by
    ORDER BY CASE p.language_code WHEN 'tiv' THEN 1 WHEN 'idoma' THEN 2 WHEN 'igede' THEN 3 ELSE 4 END,p.language_name
  `);

  const imports=await query(`
    SELECT i.*,u.name created_by_name
    FROM translation_pack_imports i
    LEFT JOIN users u ON u.id=i.created_by
    ORDER BY i.created_at DESC
    LIMIT 30
  `);

  return NextResponse.json({
    data:packs.rows.map((row:any)=>{
      const check=validateTranslationMap(row.translations);
      return{...row,coverage:check.coverage,translatedKeys:check.translated,requiredKeys:check.required,missingKeys:check.missing,unknownKeys:check.unknown};
    }),
    imports:imports.rows,
    targets:targetLanguages
  });
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    languageCode?:string;source?:string;version?:string;translations?:unknown;
  }|null;

  const rawLanguageCode=String(body?.languageCode||"").trim().toLowerCase();
  const target=targetLanguages.find(x=>x.code===rawLanguageCode);
  if(!target)return error("Unsupported translation language.");
  if(target.code==="en")return error("English is the built-in fallback and cannot be replaced through translation packs.");
  const languageCode=target.code;

  const source=String(body?.source||"").trim().slice(0,300);
  const version=String(body?.version||"").trim().slice(0,120);
  if(source.length<2)return error("Translation source / reviewer context is required.");
  if(!version)return error("Translation pack version is required.");

  const check=validateTranslationMap(body?.translations);
  if(!Object.keys(check.translations).length)return error("Translation pack contains no recognized non-empty CARE-Map keys.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO translation_packs(
        language_code,language_name,native_name,translations,source,version,status,enabled,
        reviewed_by,reviewed_at,created_by,updated_by
      )
      VALUES($1,$2,$3,$4,$5,$6,'draft',FALSE,NULL,NULL,$7,$7)
      ON CONFLICT(language_code) DO UPDATE SET
        translations=EXCLUDED.translations,
        source=EXCLUDED.source,
        version=EXCLUDED.version,
        status='draft',
        enabled=FALSE,
        reviewed_by=NULL,
        reviewed_at=NULL,
        updated_by=EXCLUDED.updated_by
    `,[languageCode,target.name,target.nativeName,JSON.stringify(check.translations),source,version,session.sub]);

    await client.query(`
      INSERT INTO translation_pack_imports(
        language_code,source,version,translated_keys,required_keys,coverage_pct,unknown_keys,missing_keys,created_by
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,[
      languageCode,source,version,check.translated,check.required,check.coverage,
      JSON.stringify(check.unknown),JSON.stringify(check.missing),session.sub
    ]);

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'translation_pack_import','translation_pack',$2)",
      [session.sub,JSON.stringify({languageCode,source,version,coverage:check.coverage,translated:check.translated,required:check.required})]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{
      languageCode,status:"draft",enabled:false,coverage:check.coverage,
      translatedKeys:check.translated,requiredKeys:check.required,
      missingKeys:check.missing,unknownKeys:check.unknown
    }},{status:201});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Translation pack import failed.",400);
  }finally{
    client.release();
  }
}
