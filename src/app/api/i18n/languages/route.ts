import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {targetLanguages} from "@/lib/i18n";

export const dynamic="force-dynamic";

export async function GET(){
  const english=targetLanguages[0];
  try{
    const exists=await query<{present:boolean}>("SELECT to_regclass('public.translation_packs') IS NOT NULL present");
    if(!exists.rows[0]?.present)return NextResponse.json({data:[english]});
    const result=await query<{language_code:string;language_name:string;native_name:string}>(`
      SELECT language_code,language_name,native_name
      FROM translation_packs
      WHERE status='reviewed' AND enabled=TRUE
      ORDER BY language_name
    `);
    return NextResponse.json({
      data:[
        english,
        ...result.rows.map(r=>({code:r.language_code,name:r.language_name,nativeName:r.native_name}))
      ]
    },{headers:{"cache-control":"public, max-age=300"}});
  }catch{
    return NextResponse.json({data:[english]});
  }
}
