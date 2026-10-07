import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {acceptanceChecks} from "@/lib/field-acceptance";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function str(value:unknown){return value==null?"":String(value).trim();}

export async function GET(){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const [runs,lgas,summary]=await Promise.all([
    query(`
      SELECT r.id,r.lga_code,l.name lga_name,l.pilot,r.device_label,r.device_info,r.network_context,
        r.app_version,r.status,r.result,r.notes,r.started_at,r.completed_at,r.created_at,
        u.name created_by_name,
        count(c.id)::int check_count,
        count(c.id) FILTER(WHERE c.required)::int required_checks,
        count(c.id) FILTER(WHERE c.required AND c.status='pass')::int required_passed,
        count(c.id) FILTER(WHERE c.status='fail')::int failed_checks,
        count(c.id) FILTER(WHERE c.status='blocked')::int blocked_checks
      FROM field_acceptance_runs r
      JOIN lgas l ON l.code=r.lga_code
      LEFT JOIN users u ON u.id=r.created_by
      LEFT JOIN field_acceptance_checks c ON c.run_id=r.id
      GROUP BY r.id,l.name,l.pilot,u.name
      ORDER BY r.started_at DESC
      LIMIT 100
    `),
    query("SELECT code,name,pilot FROM lgas ORDER BY pilot DESC,name"),
    query(`
      WITH latest_pilot AS (
        SELECT DISTINCT ON (r.lga_code)
          r.lga_code,r.result,r.completed_at
        FROM field_acceptance_runs r
        JOIN lgas l ON l.code=r.lga_code
        WHERE l.pilot=TRUE AND r.status='completed'
        ORDER BY r.lga_code,r.completed_at DESC
      )
      SELECT
        (SELECT count(*) FROM lgas WHERE pilot=TRUE)::int pilot_lgas,
        count(*)::int pilot_lgas_tested,
        count(*) FILTER(WHERE result='pass')::int pilot_lgas_passed,
        count(*) FILTER(WHERE result='conditional')::int pilot_lgas_conditional,
        count(*) FILTER(WHERE result='fail')::int pilot_lgas_failed
      FROM latest_pilot
    `)
  ]);

  return NextResponse.json({
    data:runs.rows,
    lgas:lgas.rows,
    summary:summary.rows[0]
  });
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    lgaCode?:string;deviceLabel?:string;deviceInfo?:string|null;networkContext?:string|null;
    appVersion?:string|null;notes?:string|null;
  }|null;

  const lgaCode=str(body?.lgaCode).toUpperCase();
  const deviceLabel=str(body?.deviceLabel).slice(0,200);
  const deviceInfo=str(body?.deviceInfo).slice(0,1000)||null;
  const networkContext=str(body?.networkContext).slice(0,300)||null;
  const appVersion=str(body?.appVersion).slice(0,120)||null;
  const notes=str(body?.notes).slice(0,3000)||null;

  if(!lgaCode)return error("LGA is required.");
  if(deviceLabel.length<2)return error("Device label is required.");

  const lga=await query<{code:string;name:string;pilot:boolean}>(
    "SELECT code,name,pilot FROM lgas WHERE code=$1",[lgaCode]
  );
  if(!lga.rowCount)return error("Unknown LGA.",404);

  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const run=await client.query<{id:string}>(`
      INSERT INTO field_acceptance_runs(
        lga_code,device_label,device_info,network_context,app_version,notes,created_by,updated_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$7)
      RETURNING id
    `,[lgaCode,deviceLabel,deviceInfo,networkContext,appVersion,notes,session.sub]);

    const runId=run.rows[0].id;
    for(let i=0;i<acceptanceChecks.length;i++){
      const check=acceptanceChecks[i];
      await client.query(`
        INSERT INTO field_acceptance_checks(
          run_id,check_key,category,label,instructions,required,sort_order
        ) VALUES($1,$2,$3,$4,$5,$6,$7)
      `,[runId,check.key,check.category,check.label,check.instructions,check.required,i+1]);
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'field_acceptance_create','field_acceptance',$2,$3)",
      [session.sub,runId,JSON.stringify({lgaCode,deviceLabel,pilot:lga.rows[0].pilot,checks:acceptanceChecks.length})]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:{id:runId,lga:lga.rows[0],checks:acceptanceChecks.length}},{status:201});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Could not create field acceptance run.",400);
  }finally{
    client.release();
  }
}
