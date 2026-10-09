import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import pg from "pg";
import { bootstrapAdmin, initializeDatabase } from "@/lib/infrastructure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(message: string, status: number, extras: Record<string,unknown> = {}) {
  return NextResponse.json({ok:status<400,message,...extras},{status,headers:{"Cache-Control":"no-store"}});
}

function sameOrigin(request:NextRequest) {
  const origin=request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.nextUrl.host && new URL(origin).protocol === request.nextUrl.protocol; }
  catch { return false; }
}

function validToken(submitted:string, expected:string) {
  const x=crypto.createHash("sha256").update(submitted).digest();
  const y=crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(x,y);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply("Invalid request origin.",403);
  const expected=process.env.SETUP_TOKEN;
  if (!expected || expected.length<32) return reply("Set a 32+ character SETUP_TOKEN in Vercel Production and redeploy.",503);
  let submitted="";
  try {
    const body=await request.json();
    submitted=typeof body?.token==="string" ? body.token : "";
  } catch { return reply("Invalid request.",400); }
  if (!validToken(submitted,expected)) return reply("Incorrect setup key.",403);

  const databaseUrl=process.env.DATABASE_URL;
  const caCert=process.env.AIVEN_CA_CERT;
  const email=process.env.ADMIN_EMAIL;
  const password=process.env.ADMIN_PASSWORD;
  if (!databaseUrl || !caCert || !email || !password) {
    return reply("DATABASE_URL, AIVEN_CA_CERT, ADMIN_EMAIL and ADMIN_PASSWORD must be set in Vercel Production.",503);
  }
  if (password.length<12) return reply("ADMIN_PASSWORD must have at least 12 characters.",503);

  const client=new pg.Client({
    connectionString:databaseUrl,
    ssl:{ca:caCert.replace(/\\n/g,"\n"),rejectUnauthorized:true},
    connectionTimeoutMillis:10000
  });
  try {
    await client.connect();
    const users=await client.query<{present:boolean}>("SELECT to_regclass('public.users') IS NOT NULL AS present");
    if (users.rows[0]?.present) {
      const count=await client.query<{count:string}>("SELECT count(*)::text AS count FROM users WHERE role='admin' AND active=TRUE AND deleted_at IS NULL");
      if (Number(count.rows[0]?.count)>0) return reply("Setup is locked because an active administrator exists. Sign in normally.",409);
    }
  } catch {
    return reply("Database connection failed. Check the Aiven service, URI and CA certificate.",503);
  } finally { await client.end().catch(()=>{}); }

  try {
    const migrations=await initializeDatabase({databaseUrl,caCert});
    // One-time bootstrap only: never rotate an existing administrator through this route.
    const verify=new pg.Client({connectionString:databaseUrl,ssl:{ca:caCert.replace(/\\n/g,"\n"),rejectUnauthorized:true},connectionTimeoutMillis:10000});
    try {
      await verify.connect();
      const count=await verify.query<{count:string}>("SELECT count(*)::text AS count FROM users WHERE role='admin' AND active=TRUE AND deleted_at IS NULL");
      if (Number(count.rows[0]?.count)>0) return reply("An administrator already exists. Setup is locked.",409);
    } finally {await verify.end().catch(()=>{});}
    await bootstrapAdmin({databaseUrl,caCert},email,password);
    return reply("Database migrations completed and the first administrator account was created. Remove SETUP_TOKEN and ADMIN_PASSWORD from Vercel, redeploy, and sign in.",200,{migrations:migrations.migrations,appliedNow:migrations.appliedNow,skipped:migrations.skipped});
  } catch {
    return reply("Setup could not complete. Check database permissions, migration history, and server logs. No credentials are included in this response.",500);
  }
}
