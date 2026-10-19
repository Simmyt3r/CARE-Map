import {NextResponse} from "next/server";
import {publicMapCounts} from "@/lib/map-public-counts";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Exact published-map totals per layer, optional LGA and status, independent of viewport. */
export async function GET(request:Request){
  const p=new URL(request.url).searchParams;
  const lga=p.get("lga")||null;
  const status=p.get("status")||null;
  if(lga&&!/^[a-zA-Z0-9_-]{1,30}$/.test(lga)){
    return NextResponse.json({error:"Invalid LGA code."},{status:400});
  }
  if(status&&!["functional","needs_maintenance","non_functional"].includes(status)){
    return NextResponse.json({error:"Invalid map status filter."},{status:400});
  }
  try{
    const data=await publicMapCounts({lga,status});
    return NextResponse.json({data,filters:{lga,status}},{
      headers:{"Cache-Control":"public, max-age=0, s-maxage=30, stale-while-revalidate=30"}
    });
  }catch(e){
    const code=e&&typeof e==="object"&&"code" in e?String(e.code):"UNKNOWN";
    console.error("Public map count query failed",{code});
    return NextResponse.json({error:"Map totals are temporarily unavailable."},{status:503,
      headers:{"Cache-Control":"no-store"}});
  }
}
