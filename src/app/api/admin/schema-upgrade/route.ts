import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {initializeDatabase} from "@/lib/infrastructure";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function POST(request:Request){
  const session=await getSession();
  if(!isAdmin(session))return NextResponse.json({ok:false,message:"Administrator access required."},{status:403});
  if(request.headers.get("origin")!==new URL(request.url).origin){
    return NextResponse.json({ok:false,message:"Invalid request origin."},{status:403});
  }
  const db=process.env.DATABASE_URL,ca=process.env.AIVEN_CA_CERT;
  if(!db||!ca)return NextResponse.json({ok:false,message:"Aiven database URL and CA certificate are not configured."},{status:503});
  try{
    const result=await initializeDatabase({databaseUrl:db,caCert:ca});
    return NextResponse.json({ok:true,message:"Database schema is up to date.",data:{
      total:result.migrations,appliedNow:result.appliedNow,alreadyApplied:result.skipped
    }},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({ok:false,message:"Schema upgrade failed. Check migration checksums and Vercel function logs before retrying."},{status:500});
  }
}
