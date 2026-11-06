import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {query} from "@/lib/db";

export function error(message:string,status=400,code="BAD_REQUEST"){
  return NextResponse.json({error:{code,message}},{status,headers:{"Cache-Control":"no-store"}});
}
export function clientIp(request:Request){
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
}

/**
 * A shared PostgreSQL fixed-window limiter, atomic across Vercel instances.
 * Keys are HMACs so client IPs are not stored in the rate-limit table.
 * Requires migration 021 and a consistent 32+ character secret.
 */
type BucketQuery=(sql:string,params:unknown[])=>Promise<{rows:{current_hits:number|string}[]}>;

/** Injectable query runner permits real multi-connection concurrency tests. */
export async function rateLimitWithQuery(key:string,limit:number,windowMs:number,execute:BucketQuery):Promise<boolean>{
  if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(windowMs)||windowMs<1)
    throw new Error("Invalid rate-limit configuration.");
  const secret=process.env.RATE_LIMIT_SECRET||process.env.SESSION_SECRET;
  if(!secret||secret.length<32)throw new Error("Shared rate-limit secret is unavailable.");
  const digest=crypto.createHmac("sha256",secret).update(key).digest("hex");
  const result=await execute(`
    INSERT INTO api_rate_limit_buckets(key_hash,hits,reset_at)
    VALUES($1,1,clock_timestamp()+($2::bigint*interval '1 millisecond'))
    ON CONFLICT(key_hash) DO UPDATE SET
      hits=CASE WHEN api_rate_limit_buckets.reset_at<=clock_timestamp()
        THEN 1 ELSE LEAST(api_rate_limit_buckets.hits+1,$3::integer+1) END,
      reset_at=CASE WHEN api_rate_limit_buckets.reset_at<=clock_timestamp()
        THEN clock_timestamp()+($2::bigint*interval '1 millisecond')
        ELSE api_rate_limit_buckets.reset_at END
    RETURNING hits AS current_hits
  `,[digest,windowMs,limit]);
  return Number(result.rows[0]?.current_hits)<=limit;
}

export async function rateLimit(key:string,limit:number,windowMs:number):Promise<boolean>{
  return rateLimitWithQuery(key,limit,windowMs,(sql,params)=>query<{current_hits:number}>(sql,params));
}

/** Fail closed on connectivity/schema errors; never reset to a per-process Map. */
export async function rateLimitGuard(key:string,limit:number,windowMs:number,message:string):Promise<NextResponse|null>{
  try{
    if(await rateLimit(key,limit,windowMs))return null;
    return error(message,429,"RATE_LIMITED");
  }catch(e){
    const code=(e&&typeof e==="object"&&"code" in e)?String(e.code):"UNAVAILABLE";
    console.error("Shared rate limiter unavailable",{code});
    return error("Service temporarily unavailable. Please try again later.",503,"RATE_LIMIT_UNAVAILABLE");
  }
}

export async function pruneExpiredRateLimits(){
  const result=await query(`
    DELETE FROM api_rate_limit_buckets
    WHERE key_hash IN (
      SELECT key_hash FROM api_rate_limit_buckets
      WHERE reset_at < clock_timestamp()-interval '1 day'
      ORDER BY reset_at LIMIT 5000
    )
  `);
  return result.rowCount||0;
}
export function parseBbox(value:string|null){
  if(!value)return null;
  const p=value.split(",").map(Number);
  if(p.length!==4||p.some(Number.isNaN))return null;
  const[minLng,minLat,maxLng,maxLat]=p;
  if(minLng>=maxLng||minLat>=maxLat||minLng< -180||maxLng>180||minLat< -90||maxLat>90)return null;
  return{minLng,minLat,maxLng,maxLat};
}
