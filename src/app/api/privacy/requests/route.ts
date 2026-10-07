import {NextResponse} from "next/server";
import {clientIp,error,rateLimit} from "@/lib/http";
import {getSession} from "@/lib/auth";
import {query} from "@/lib/db";
import {
  dataSubjectRequestTypes,
  isDataSubjectRequestType,
  privacyReference
} from "@/lib/privacy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  const ip=clientIp(request);
  if(!rateLimit("privacy-request:"+ip,6,60*60_000))return error("Too many privacy requests from this connection. Try again later.",429,"RATE_LIMITED");

  const body=await request.json().catch(()=>null) as {
    requestType?:string;name?:string;email?:string;phone?:string;description?:string;
  }|null;

  const requestType=String(body?.requestType||"").trim().toLowerCase();
  const name=String(body?.name||"").trim().slice(0,160);
  const email=String(body?.email||"").trim().toLowerCase().slice(0,254);
  const phone=String(body?.phone||"").trim().slice(0,80)||null;
  const description=String(body?.description||"").trim().slice(0,5000);

  if(!isDataSubjectRequestType(requestType))return error("Choose a valid privacy-right request.");
  if(name.length<2)return error("Your name is required.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return error("Provide a valid email address.");
  if(description.length<10)return error("Please describe what you are requesting.");

  const session=await getSession();
  const reference=privacyReference();

  await query(`
    INSERT INTO data_subject_requests(
      reference_code,request_type,requester_name,requester_email,requester_phone,user_id,description
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
  `,[reference,requestType,name,email,phone,session?.sub||null,description]);

  return NextResponse.json({
    data:{
      reference,
      status:"submitted",
      requestType,
      dueInDays:30,
      types:dataSubjectRequestTypes
    }
  },{status:201});
}

export async function GET(request:Request){
  const ip=clientIp(request);
  if(!rateLimit("privacy-status:"+ip,20,60*60_000))return error("Too many status checks. Try again later.",429,"RATE_LIMITED");

  const url=new URL(request.url);
  const reference=String(url.searchParams.get("reference")||"").trim().toUpperCase();
  const email=String(url.searchParams.get("email")||"").trim().toLowerCase();

  if(!/^PRV-\d{8}-[A-F0-9]{12}$/.test(reference))return error("Provide a valid privacy request reference.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return error("Provide the email used for the request.");

  const result=await query(`
    SELECT reference_code,request_type,status,submitted_at,due_at,completed_at
    FROM data_subject_requests
    WHERE reference_code=$1 AND lower(requester_email::text)=$2
    LIMIT 1
  `,[reference,email]);

  if(!result.rowCount)return error("Privacy request not found.",404);
  return NextResponse.json({data:result.rows[0]});
}
