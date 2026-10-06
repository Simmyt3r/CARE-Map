import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const allowedTypes=new Set(["borehole","asset","forest_site","river","report"]);

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lat=Number(url.searchParams.get("lat"));
  const lng=Number(url.searchParams.get("lng"));
  const radius=Math.min(50_000,Math.max(10,Number(url.searchParams.get("radius")||1000)));
  const type=url.searchParams.get("type")||"";
  const limit=Math.min(250,Math.max(1,Number(url.searchParams.get("limit")||100)));

  if(!Number.isFinite(lat)||lat< -90||lat>90)return error("Valid latitude is required.");
  if(!Number.isFinite(lng)||lng< -180||lng>180)return error("Valid longitude is required.");
  if(type&&!allowedTypes.has(type))return error("Invalid feature type.");
  if(!Number.isFinite(radius))return error("Invalid radius.");

  const point="ST_SetSRID(ST_MakePoint($1,$2),4326)";
  const configs=[
    ["borehole","boreholes","location","name","status","risk_level","TRUE"],
    ["asset","assets","location","name","status","risk_level","TRUE"],
    ["forest_site","forest_sites","boundary","name","status","risk_level","TRUE"],
    ["river","rivers","course","COALESCE(name,local_name,'Unnamed river')","stress_indicator","risk_level","verified=TRUE"],
    ["report","reports","location","LEFT(description,100)","status","priority","status NOT IN ('resolved','rejected')"]
  ] as const;

  const rows:any[]=[];
  for(const[entityType,table,geom,nameExpr,statusExpr,riskExpr,visibility]of configs){
    if(type&&type!==entityType)continue;
    const result=await query(
      `SELECT id,'${entityType}' entity_type,${nameExpr} name,
              ${table==="reports"?"NULL::text":"lga_code"} lga_code,
              ${statusExpr} status,${riskExpr} risk_level,
              round(ST_Distance(${geom}::geography,${point}::geography)::numeric,1) distance_m,
              ST_AsGeoJSON(${geom})::json geometry
       FROM ${table}
       WHERE ${visibility}
         AND ST_DWithin(${geom}::geography,${point}::geography,$3)
       ORDER BY ST_Distance(${geom}::geography,${point}::geography)
       LIMIT $4`,
      [lng,lat,radius,limit]
    );
    rows.push(...result.rows);
  }

  rows.sort((a,b)=>Number(a.distance_m)-Number(b.distance_m));
  return NextResponse.json({
    data:rows.slice(0,limit),
    query:{latitude:lat,longitude:lng,radiusM:radius,type:type||"all"},
    total:Math.min(rows.length,limit)
  });
}
