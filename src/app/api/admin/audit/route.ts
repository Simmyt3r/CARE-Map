import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required",403,"FORBIDDEN");
  const url=new URL(request.url);
  const action=url.searchParams.get("action");
  const entityType=url.searchParams.get("entityType");
  const actor=url.searchParams.get("actor");
  const clauses:string[]=[];
  const params:unknown[]=[];
  const add=(sql:string,value:unknown)=>{params.push(value);clauses.push(sql.replace("?","$"+params.length));};
  if(action)add("a.action=?",action);
  if(entityType)add("a.entity_type=?",entityType);
  if(actor)add("a.actor_id=?",actor);
  const result=await query(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.created_at,u.name actor_name,u.email actor_email
    FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
    ${clauses.length?"WHERE "+clauses.join(" AND "):""}
    ORDER BY a.created_at DESC LIMIT 500`,params);
  return NextResponse.json({data:result.rows,total:result.rowCount});
}
