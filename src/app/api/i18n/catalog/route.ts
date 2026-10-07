import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {DEFAULT_LOCALE,englishCatalog,mergeCatalog,normalizeLocale} from "@/lib/i18n";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const locale=normalizeLocale(new URL(request.url).searchParams.get("lang"));
  if(locale===DEFAULT_LOCALE){
    return NextResponse.json({
      locale:DEFAULT_LOCALE,
      requested:locale,
      fallback:false,
      translations:englishCatalog
    },{headers:{"cache-control":"public, max-age=300"}});
  }

  try{
    const exists=await query<{present:boolean}>("SELECT to_regclass('public.translation_packs') IS NOT NULL present");
    if(!exists.rows[0]?.present)throw new Error("translation table unavailable");
    const result=await query<{translations:Record<string,string>}>(`
      SELECT translations
      FROM translation_packs
      WHERE language_code=$1 AND status='reviewed' AND enabled=TRUE
      LIMIT 1
    `,[locale]);

    const pack=result.rows[0]?.translations;
    if(!pack)throw new Error("reviewed pack unavailable");

    return NextResponse.json({
      locale,
      requested:locale,
      fallback:false,
      translations:mergeCatalog(pack)
    },{headers:{"cache-control":"public, max-age=300"}});
  }catch{
    return NextResponse.json({
      locale:DEFAULT_LOCALE,
      requested:locale,
      fallback:true,
      translations:englishCatalog
    },{headers:{"cache-control":"public, max-age=60"}});
  }
}
