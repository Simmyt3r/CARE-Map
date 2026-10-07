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

type Row=Record<string,unknown>;
type Feature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown};
  properties?:Record<string,unknown>;
};

function str(value:unknown){
  return value==null?"":String(value).trim();
}

function pointFromCsv(row:Row){
  const lat=Number(row.latitude??row.lat);
  const lng=Number(row.longitude??row.lng??row.lon);
  if(!Number.isFinite(lat)||lat< -90||lat>90)throw new Error("Invalid latitude.");
  if(!Number.isFinite(lng)||lng< -180||lng>180)throw new Error("Invalid longitude.");
  return {latitude:lat,longitude:lng};
}

function pointFromFeature(feature:Feature){
  if(feature.type!=="Feature")throw new Error("Item must be a GeoJSON Feature.");
  if(feature.geometry?.type!=="Point"||!Array.isArray(feature.geometry.coordinates)){
    throw new Error("Settlement GeoJSON geometry must be Point.");
  }
  const coordinates=feature.geometry.coordinates as unknown[];
  const lng=Number(coordinates[0]);
  const lat=Number(coordinates[1]);
  if(!Number.isFinite(lat)||lat< -90||lat>90)throw new Error("Invalid Point latitude.");
  if(!Number.isFinite(lng)||lng< -180||lng>180)throw new Error("Invalid Point longitude.");
  return {latitude:lat,longitude:lng};
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    source?:string;
    format?:string;
    rows?:Row[];
    features?:Feature[];
    verified?:boolean;
    defaultPopulationSource?:string|null;
    defaultPopulationYear?:number|string|null;
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
  if(items.length>2000)return error("Settlement import is limited to 2,000 records per batch.");
  if(JSON.stringify(items).length>10_000_000)return error("Settlement import payload must be 10 MB or smaller.");

  const client=await pool().connect();
  const failures:{row:number;message:string}[]=[];
  let imported=0;
  let autoAssigned=0;

  try{
    await client.query("BEGIN");
    const lgaResult=await client.query<{code:string}>("SELECT code FROM lgas ORDER BY code");
    const validLgas=new Set(lgaResult.rows.map(x=>x.code));

    const job=await client.query<{id:string}>(`
      INSERT INTO settlement_imports(source,format,verified_on_import,total_rows,created_by)
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
    `,[source,format,verified,items.length,session.sub]);

    for(let i=0;i<items.length;i++){
      const savepoint="settlement_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        const item=items[i] as Row|Feature;
        const properties=format==="csv"
          ?item as Row
          :(item as Feature).properties||{};
        const point=format==="csv"
          ?pointFromCsv(properties)
          :pointFromFeature(item as Feature);

        const name=str(properties.name||properties.settlementName||properties.settlement_name).slice(0,200);
        if(!name)throw new Error("Settlement name is required.");

        const rawType=str(properties.settlementType||properties.settlement_type||properties.category||"community").toLowerCase();
        if(!isSettlementType(rawType))throw new Error("Invalid settlement type: "+rawType);

        const population=parseOptionalPopulation(properties.population);
        if(population===undefined)throw new Error("Population must be a whole number from 0 to 100,000,000.");

        const rowPopulationSource=str(properties.populationSource||properties.population_source);
        const populationSource=population==null?"":(rowPopulationSource||defaultPopulationSource);

        const rowYear=properties.populationYear??properties.population_year;
        const populationYear=parseOptionalPopulationYear(
          rowYear==null||str(rowYear)===""
            ?(population==null?null:defaultPopulationYear)
            :rowYear
        );
        if(populationYear===undefined)throw new Error("Population year must be between 1900 and 2200.");

        const provenanceError=populationProvenanceError(population,populationSource,populationYear);
        if(provenanceError)throw new Error(provenanceError);

        const gpsAccuracy=parseOptionalGpsAccuracy(properties.gpsAccuracy??properties.gps_accuracy_m);
        if(gpsAccuracy===undefined)throw new Error("GPS accuracy must be between 0 and 100,000 metres.");

        let lgaCode=normalizeLgaToken(properties.lgaCode||properties.lga_code||properties.lga);
        if(lgaCode){
          if(!validLgas.has(lgaCode))throw new Error("Unknown LGA code: "+lgaCode);
        }else{
          const matches=await client.query<{code:string}>(`
            SELECT code
            FROM lgas
            WHERE boundary IS NOT NULL
              AND ST_Covers(
                boundary,
                ST_SetSRID(ST_MakePoint($1,$2),4326)
              )
            ORDER BY code
            LIMIT 2
          `,[point.longitude,point.latitude]);
          if(matches.rowCount===0){
            throw new Error("LGA is missing and this point could not be assigned from imported LGA boundaries.");
          }
          if((matches.rowCount||0)>1){
            throw new Error("Settlement point matches more than one LGA boundary; review the coordinate/boundaries.");
          }
          lgaCode=matches.rows[0].code;
          autoAssigned++;
        }

        const settlementCode=str(properties.settlementCode||properties.settlement_code||properties.code).slice(0,120)||null;
        const notes=str(properties.notes||properties.description).slice(0,2000)||null;

        await client.query(`
          INSERT INTO settlements(
            settlement_code,name,settlement_type,lga_code,location,
            population,population_year,population_source,
            source,verified,gps_accuracy_m,notes,created_by,updated_by
          ) VALUES(
            $1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326),
            $7,$8,$9,$10,$11,$12,$13,$14,$14
          )
        `,[
          settlementCode,name,rawType,lgaCode,point.longitude,point.latitude,
          population,populationYear,populationSource||null,
          source,verified,gpsAccuracy,notes,session.sub
        ]);

        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        failures.push({row:i+1,message:e instanceof Error?e.message:"Settlement import failed."});
      }
    }

    await client.query(`
      UPDATE settlement_imports
      SET imported_rows=$1,failed_rows=$2,auto_assigned_lga_rows=$3,errors=$4
      WHERE id=$5
    `,[imported,failures.length,autoAssigned,JSON.stringify(failures.slice(0,100)),job.rows[0].id]);

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'settlement_import','settlement',$2)",
      [session.sub,JSON.stringify({
        source,format,verified,total:items.length,imported,failed:failures.length,
        autoAssignedLga:autoAssigned,jobId:job.rows[0].id
      })]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{
      jobId:job.rows[0].id,
      total:items.length,
      imported,
      failed:failures.length,
      autoAssignedLga:autoAssigned,
      errors:failures
    }});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Settlement import failed.",400);
  }finally{
    client.release();
  }
}
