import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {
  isEnvironmentalHazardType,isEnvironmentalSeverity,normalizeEnvironmentalZoneCode
} from "@/lib/environmental-risk";

type Feature={type?:string;geometry?:{type?:string;coordinates?:unknown}|null;properties?:Record<string,unknown>};

function str(value:unknown){return value==null?"":String(value).trim();}
function dateValue(value:unknown){
  const text=str(value);
  if(!text)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(text+"T00:00:00Z")))return undefined;
  return text;
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    source?:string;features?:Feature[];verified?:boolean;
    defaultHazardType?:string;defaultSeverity?:string;
    defaultSourceDate?:string|null;defaultValidFrom?:string|null;defaultValidTo?:string|null;
  }|null;

  const source=str(body?.source).slice(0,300);
  const features=body?.features;
  const verified=Boolean(body?.verified);
  const defaultHazard=str(body?.defaultHazardType).toLowerCase();
  const defaultSeverity=str(body?.defaultSeverity||"medium").toLowerCase();
  const defaultSourceDate=dateValue(body?.defaultSourceDate);
  const defaultValidFrom=dateValue(body?.defaultValidFrom);
  const defaultValidTo=dateValue(body?.defaultValidTo);

  if(source.length<2)return error("Risk-zone dataset source / provenance is required.");
  if(!Array.isArray(features)||!features.length)return error("Provide a GeoJSON FeatureCollection with polygon features.");
  if(features.length>500)return error("Risk-zone import is limited to 500 features per batch.");
  if(JSON.stringify(features).length>10_000_000)return error("Risk-zone import payload must be 10 MB or smaller.");
  if(defaultHazard&&!isEnvironmentalHazardType(defaultHazard))return error("Invalid default hazard type.");
  if(!isEnvironmentalSeverity(defaultSeverity))return error("Invalid default severity.");
  if(defaultSourceDate===undefined||defaultValidFrom===undefined||defaultValidTo===undefined)return error("Default dates must use YYYY-MM-DD.");
  if(defaultValidFrom&&defaultValidTo&&defaultValidTo<defaultValidFrom)return error("Default valid-to date cannot be before valid-from.");

  const client=await pool().connect();
  const failures:{row:number;message:string}[]=[];
  let imported=0;

  try{
    await client.query("BEGIN");
    const job=await client.query<{id:string}>(`
      INSERT INTO environmental_risk_zone_imports(source,verified_on_import,total_features,created_by)
      VALUES($1,$2,$3,$4) RETURNING id
    `,[source,verified,features.length,session.sub]);

    for(let i=0;i<features.length;i++){
      const savepoint="risk_zone_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        const feature=features[i];
        if(feature?.type!=="Feature")throw new Error("Item must be a GeoJSON Feature.");
        if(!feature.geometry||!["Polygon","MultiPolygon"].includes(String(feature.geometry.type))){
          throw new Error("Risk-zone geometry must be Polygon or MultiPolygon.");
        }
        const p=feature.properties||{};
        const name=str(p.name||p.zoneName||p.zone_name).slice(0,200);
        if(!name)throw new Error("Risk-zone name is required.");

        const hazard=str(p.hazardType||p.hazard_type||p.hazard||defaultHazard).toLowerCase();
        if(!isEnvironmentalHazardType(hazard))throw new Error("Invalid hazard type: "+hazard);

        const severity=str(p.severity||defaultSeverity).toLowerCase();
        if(!isEnvironmentalSeverity(severity))throw new Error("Invalid severity: "+severity);

        const sourceDate=dateValue(p.sourceDate??p.source_date??defaultSourceDate);
        const validFrom=dateValue(p.validFrom??p.valid_from??defaultValidFrom);
        const validTo=dateValue(p.validTo??p.valid_to??defaultValidTo);
        if(sourceDate===undefined||validFrom===undefined||validTo===undefined)throw new Error("Dates must use YYYY-MM-DD.");
        if(validFrom&&validTo&&validTo<validFrom)throw new Error("validTo cannot be before validFrom.");

        const zoneCode=normalizeEnvironmentalZoneCode(p.zoneCode||p.zone_code||p.code)||null;
        const notes=str(p.notes||p.description).slice(0,2000)||null;
        const geo=JSON.stringify(feature.geometry);

        const inserted=await client.query(`
          WITH normalized AS (
            SELECT ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_Force2D(
                    ST_SetSRID(ST_GeomFromGeoJSON($1),4326)
                  )
                ),3
              )
            )::geometry(MultiPolygon,4326) geom
          )
          INSERT INTO environmental_risk_zones(
            zone_code,name,hazard_type,severity,boundary,source,source_date,
            valid_from,valid_to,verified,notes,created_by,updated_by
          )
          SELECT $2,$3,$4,$5,n.geom,$6,$7,$8,$9,$10,$11,$12,$12
          FROM normalized n
          WHERE n.geom IS NOT NULL
            AND NOT ST_IsEmpty(n.geom)
            AND ST_Area(n.geom::geography)>=100
            AND ST_Area(n.geom::geography)<=100000000000
          RETURNING id
        `,[geo,zoneCode,name,hazard,severity,source,sourceDate,validFrom,validTo,verified,notes,session.sub]);
        if(!inserted.rowCount)throw new Error("Risk-zone geometry must be between 100 m² and 100,000 km² after validation.");

        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        failures.push({row:i+1,message:e instanceof Error?e.message:"Risk-zone import failed."});
      }
    }

    await client.query(`
      UPDATE environmental_risk_zone_imports
      SET imported_features=$1,failed_features=$2,errors=$3
      WHERE id=$4
    `,[imported,failures.length,JSON.stringify(failures.slice(0,100)),job.rows[0].id]);

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'risk_zone_import','environmental_risk_zone',$2)",
      [session.sub,JSON.stringify({source,verified,total:features.length,imported,failed:failures.length,jobId:job.rows[0].id})]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{
      jobId:job.rows[0].id,total:features.length,imported,failed:failures.length,errors:failures
    }});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Risk-zone import failed.",400);
  }finally{
    client.release();
  }
}
