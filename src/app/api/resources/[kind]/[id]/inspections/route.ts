import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const entityMap:Record<string,string>={boreholes:"borehole",assets:"asset","forest-sites":"forest_site",rivers:"river"};
const conditions=new Set(["good","fair","poor","critical"]);

export async function GET(_:Request,context:{params:Promise<{kind:string;id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{kind,id}=await context.params;
  const entityType=entityMap[kind];
  if(!entityType)return error("Unsupported resource type",400);
  const result=await query(
    "SELECT i.*,u.name inspector_name FROM inspections i LEFT JOIN users u ON u.id=i.inspected_by WHERE i.entity_type=$1 AND i.entity_id=$2 ORDER BY i.inspected_at DESC LIMIT 100",
    [entityType,id]
  );
  return NextResponse.json({data:result.rows});
}

export async function POST(request:Request,context:{params:Promise<{kind:string;id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{kind,id}=await context.params;
  const entityType=entityMap[kind];
  if(!entityType)return error("Unsupported resource type",400);
  const body=await request.json().catch(()=>null) as {condition?:string;notes?:string;latitude?:number|null;longitude?:number|null;gpsAccuracy?:number|null;inspectedAt?:string}|null;
  if(!body?.condition||!conditions.has(body.condition))return error("A valid inspection condition is required.");
  if(body.latitude!=null&&(body.latitude< -90||body.latitude>90))return error("Invalid latitude.");
  if(body.longitude!=null&&(body.longitude< -180||body.longitude>180))return error("Invalid longitude.");
  const result=await query(
    "INSERT INTO inspections(entity_type,entity_id,inspected_at,condition,notes,latitude,longitude,gps_accuracy_m,inspected_by) VALUES($1,$2,COALESCE($3::timestamptz,now()),$4,$5,$6,$7,$8,$9) RETURNING *",
    [entityType,id,body.inspectedAt||null,body.condition,body.notes||null,body.latitude??null,body.longitude??null,body.gpsAccuracy??null,session.sub]
  );
  await query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'inspect',$2,$3,$4)",[session.sub,entityType,id,JSON.stringify({condition:body.condition})]);
  return NextResponse.json({data:result.rows[0]},{status:201});
}
