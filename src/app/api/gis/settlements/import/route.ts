import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {normalizeLgaToken} from "@/lib/lga-boundaries";
import {
  isSettlementType,
  parseOptionalGpsAccuracy,
  parseOptionalPopulation,
  parseOptionalPopulationYear,
  populationProvenanceError
} from "@/lib/settlements";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

type Row=Record<string,unknown>;
type Feature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown};
  properties?:Record<string,unknown>;
};
type Normalized={
  idx:number; code:string|null;name:string;settlement_type:string;lga_code:string|null;
  latitude:number;longitude:number;population:number|null;population_year:number|null;
  population_source:string|null;gps_accuracy_m:number|null;notes:string|null;
};
const LIMIT=200;
function str(value:unknown){return value==null?"":String(value).trim();}

function pointFromCsv(row:Row){
  const lat=Number(row.latitude??row.lat);
  const lng=Number(row.longitude??row.lng??row.lon);
  if(!Number.isFinite(lat)||lat< -90||lat>90)throw new Error("Invalid latitude.");
  if(!Number.isFinite(lng)||lng< -180||lng>180)throw new Error("Invalid longitude.");
  return {latitude:lat,longitude:lng};
}
function pointFromFeature(feature:Feature){
  if(feature.type!=="Feature"||feature.geometry?.type!=="Point"||!Array.isArray(feature.geometry.coordinates)){
    throw new Error("Settlement GeoJSON geometry must be Point.");
  }
  const [lng,lat]=feature.geometry.coordinates.map(Number);
  if(!Number.isFinite(lat)||lat< -90||lat>90)throw new Error("Invalid Point latitude.");
  if(!Number.isFinite(lng)||lng< -180||lng>180)throw new Error("Invalid Point longitude.");
  return {latitude:lat,longitude:lng};
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const body=await request.json().catch(()=>null) as {
    source?:string;format?:string;rows?:Row[];features?:Feature[];
    verified?:boolean;defaultPopulationSource?:string|null;defaultPopulationYear?:number|string|null;
  }|null;
  const source=str(body?.source).slice(0,300);
  const format=str(body?.format);
  const verified=Boolean(body?.verified);
  const defaultPopulationSource=str(body?.defaultPopulationSource).slice(0,300);
  const defaultPopulationYear=parseOptionalPopulationYear(body?.defaultPopulationYear);
  if(source.length<2)return error("Settlement dataset source / provenance is required.");
  if(format!=="csv"&&format!=="geojson")return error("Settlement import format must be csv or geojson.");
  if(defaultPopulationYear===undefined)return error("Default population year is invalid.");
  const items=format==="csv"?(body?.rows||[]):(body?.features||[]);
  if(!Array.isArray(items)||!items.length)return error("No settlement records were provided.");
  if(items.length>LIMIT)return error("Submit up to "+LIMIT+" settlement records per request. Use the browser's automatic batch importer.");
  if(JSON.stringify(items).length>2_000_000)return error("Settlement import batch must be 2 MB or smaller.");

  const failures:{row:number;message:string}[]=[];
  const records:Normalized[]=[];
  const seen=new Set<string>();
  let skipped=0;
  for(let i=0;i<items.length;i++){
    try{
      const item=items[i] as Row|Feature;
      const properties=format==="csv"?(item as Row):((item as Feature).properties||{});
      const point=format==="csv"?pointFromCsv(properties):pointFromFeature(item as Feature);
      const name=str(properties.name||properties.settlementName||properties.settlement_name).slice(0,200);
      if(!name)throw new Error("Settlement name is required.");
      const kind=str(properties.settlementType||properties.settlement_type||properties.category||"community").toLowerCase();
      if(!isSettlementType(kind))throw new Error("Invalid settlement type: "+kind);
      const population=parseOptionalPopulation(properties.population);
      if(population===undefined)throw new Error("Population must be a whole number from 0 to 100,000,000.");
      const rawPopulationSource=str(properties.populationSource||properties.population_source).slice(0,300);
      const populationSource=population==null?"":(rawPopulationSource||defaultPopulationSource);
      const rawYear=properties.populationYear??properties.population_year;
      const populationYear=parseOptionalPopulationYear(
        rawYear==null||str(rawYear)===""?(population==null?null:defaultPopulationYear):rawYear
      );
      if(populationYear===undefined)throw new Error("Population year must be between 1900 and 2200.");
      const provenanceError=populationProvenanceError(population,populationSource,populationYear);
      if(provenanceError)throw new Error(provenanceError);
      const gpsAccuracy=parseOptionalGpsAccuracy(properties.gpsAccuracy??properties.gps_accuracy_m);
      if(gpsAccuracy===undefined)throw new Error("GPS accuracy must be between 0 and 100,000 metres.");
      const code=str(properties.settlementCode||properties.settlement_code||properties.code).slice(0,120)||null;
      // Deterministic keys prevent duplicate records inside a single upload batch.
      const uniqueKey=code?"code:"+code:"place:"+source+"|"+name+"|"+point.longitude+"|"+point.latitude;
      if(seen.has(uniqueKey)){skipped++;continue;}
      seen.add(uniqueKey);
      records.push({
        idx:i+1,code,name,settlement_type:kind,
        lga_code:normalizeLgaToken(properties.lgaCode||properties.lga_code||properties.lga)||null,
        latitude:point.latitude,longitude:point.longitude,
        population,population_year:populationYear,population_source:populationSource||null,
        gps_accuracy_m:gpsAccuracy,notes:str(properties.notes||properties.description).slice(0,2000)||null
      });
    }catch(e){failures.push({row:i+1,message:e instanceof Error?e.message:"Invalid settlement record."});}
  }

  const client=await pool().connect();
  let imported=0;
  let autoAssigned=0;
  try{
    await client.query("BEGIN");
    // Resolve every LGA and boundary validity inside PostgreSQL in a single query;
    // previously this required multiple round-trips for each settlement.
    const resolved=records.length?await client.query<{
      idx:number;lga_code:string|null;lga_exists:boolean;inside:boolean;
      matches:number;matched_code:string|null;
    }>(`
      WITH incoming AS (
        SELECT r.idx,r.lga_code,ST_SetSRID(ST_MakePoint(r.longitude,r.latitude),4326) pt
        FROM jsonb_to_recordset($1::jsonb) AS r(
          idx integer,lga_code text,longitude double precision,latitude double precision
        )
      )
      SELECT i.idx,i.lga_code,(l.code IS NOT NULL) lga_exists,
        CASE WHEN l.code IS NULL THEN FALSE WHEN l.boundary IS NULL THEN TRUE
          ELSE ST_Covers(l.boundary,i.pt) END inside,
        COALESCE(m.matches,0)::int matches,m.matched_code
      FROM incoming i
      LEFT JOIN lgas l ON l.code=i.lga_code
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int matches,MIN(lb.code) matched_code
        FROM lgas lb
        WHERE i.lga_code IS NULL AND lb.boundary IS NOT NULL AND ST_Covers(lb.boundary,i.pt)
      ) m ON TRUE
    `,[JSON.stringify(records)]):{rows:[]};
    const matches=new Map(resolved.rows.map(x=>[Number(x.idx),x]));
    const valid:Normalized[]=[];
    for(const item of records){
      const found=matches.get(item.idx);
      if(!found){failures.push({row:item.idx,message:"Could not determine settlement LGA."});continue;}
      if(item.lga_code){
        if(!found.lga_exists){failures.push({row:item.idx,message:"Unknown LGA code: "+item.lga_code});continue;}
        if(!found.inside){failures.push({row:item.idx,message:"Point falls outside the supplied "+item.lga_code+" boundary."});continue;}
      }else{
        if(Number(found.matches)===0){failures.push({row:item.idx,message:"Point does not match an imported LGA polygon."});continue;}
        if(Number(found.matches)>1){failures.push({row:item.idx,message:"Point intersects more than one LGA polygon."});continue;}
        item.lga_code=found.matched_code;
        autoAssigned++;
      }
      valid.push(item);
    }
    // One set-based insert handles the entire validated batch. Existing source IDs
    // and identical name+source+coordinates are skipped instead of duplicated on retry.
    if(valid.length){
      const inserted=await client.query(`
        WITH incoming AS (
          SELECT r.*,
            ST_SetSRID(ST_MakePoint(r.longitude,r.latitude),4326) pt
          FROM jsonb_to_recordset($1::jsonb) AS r(
            idx integer,code text,name text,settlement_type text,lga_code text,
            latitude double precision,longitude double precision,
            population integer,population_year integer,population_source text,
            gps_accuracy_m numeric,notes text
          )
        )
        INSERT INTO settlements(
          settlement_code,name,settlement_type,lga_code,location,
          population,population_year,population_source,
          source,verified,gps_accuracy_m,notes,created_by,updated_by
        )
        SELECT i.code,i.name,i.settlement_type,i.lga_code,i.pt,
          i.population,i.population_year,i.population_source,
          $2,$3,i.gps_accuracy_m,i.notes,$4,$4
        FROM incoming i
        WHERE NOT EXISTS (
          SELECT 1 FROM settlements s
          WHERE (i.code IS NOT NULL AND s.settlement_code=i.code)
             OR (s.source=$2 AND s.name=i.name AND ST_Equals(s.location,i.pt))
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `,[JSON.stringify(valid),source,verified,session.sub]);
      imported=inserted.rowCount||0;
      skipped+=valid.length-imported;
    }
    const job=await client.query<{id:string}>(`
      INSERT INTO settlement_imports(
        source,format,verified_on_import,total_rows,imported_rows,
        failed_rows,auto_assigned_lga_rows,errors,created_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `,[source,format,verified,items.length,imported,failures.length,
      autoAssigned,JSON.stringify(failures.slice(0,100)),session.sub]);
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'settlement_import','settlement',$2)",
      [session.sub,JSON.stringify({
        source,format,verified,total:items.length,imported,skipped,failed:failures.length,
        autoAssignedLga:autoAssigned,jobId:job.rows[0].id
      })]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:{
      jobId:job.rows[0].id,total:items.length,imported,skipped,
      failed:failures.length,autoAssignedLga:autoAssigned,errors:failures
    }});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Settlement import failed.",400);
  }finally{client.release();}
}
