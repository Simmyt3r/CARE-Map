import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {isHazardSeverity,isHazardType} from "@/lib/hazard-zones";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Feature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown}|null;
  properties?:Record<string,unknown>;
};

function str(value:unknown){
  return value==null?"":String(value).trim();
}

function parseDate(value:unknown){
  const raw=str(value);
  if(!raw)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return undefined;
  const d=new Date(raw+"T00:00:00Z");
  return Number.isNaN(d.getTime())?undefined:raw;
}

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const lga=str(url.searchParams.get("lga")).toUpperCase();
  const hazardType=str(url.searchParams.get("hazardType")).toLowerCase();
  const severity=str(url.searchParams.get("severity")).toLowerCase();
  const verifiedValue=url.searchParams.get("verified");
  const format=str(url.searchParams.get("format")).toLowerCase();

  if(hazardType&&!isHazardType(hazardType))return error("Invalid hazard type.");
  if(severity&&!isHazardSeverity(severity))return error("Invalid hazard severity.");

  const where:string[]=["TRUE"];
  const params:unknown[]=[];
  if(hazardType){params.push(hazardType);where.push("h.hazard_type=$"+params.length);}
  if(severity){params.push(severity);where.push("h.severity=$"+params.length);}
  if(verifiedValue==="1"||verifiedValue==="true"){where.push("h.verified=TRUE");}
  if(verifiedValue==="0"||verifiedValue==="false"){where.push("h.verified=FALSE");}
  if(lga){
    params.push(lga);
    const n=params.length;
    where.push("EXISTS(SELECT 1 FROM lgas l WHERE l.code=$"+n+" AND l.boundary IS NOT NULL AND ST_Intersects(h.boundary,l.boundary))");
  }

  const result=await query(`
    SELECT h.id,h.name,h.hazard_type,h.severity,h.source,h.source_date,h.method,
      h.verified,h.verified_at,h.notes,h.created_at,h.updated_at,
      round((ST_Area(h.boundary::geography)/1000000.0)::numeric,3) area_km2,
      ST_Y(ST_PointOnSurface(h.boundary)) latitude,
      ST_X(ST_PointOnSurface(h.boundary)) longitude,
      u.name verified_by_name
    FROM hazard_zones h
    LEFT JOIN users u ON u.id=h.verified_by
    WHERE ${where.join(" AND ")}
    ORDER BY h.verified DESC,
      CASE h.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
      h.updated_at DESC
    LIMIT 500
  `,params);

  if(format==="geojson"){
    const geo=await query(`
      SELECT h.id,h.name,h.hazard_type,h.severity,h.source,h.source_date,h.method,
        h.verified,h.notes,
        ST_AsGeoJSON(h.boundary)::json geometry
      FROM hazard_zones h
      WHERE ${where.join(" AND ")}
      ORDER BY h.updated_at DESC
      LIMIT 2000
    `,params);
    return NextResponse.json({
      type:"FeatureCollection",
      features:geo.rows.map((r:any)=>({
        type:"Feature",
        id:r.id,
        geometry:r.geometry,
        properties:{
          id:r.id,name:r.name,hazardType:r.hazard_type,severity:r.severity,
          source:r.source,sourceDate:r.source_date,method:r.method,verified:r.verified,notes:r.notes
        }
      }))
    });
  }

  const summary=await query(`
    SELECT
      count(*)::int total,
      count(*) FILTER(WHERE verified)::int verified,
      count(*) FILTER(WHERE NOT verified)::int unverified,
      count(*) FILTER(WHERE severity IN ('high','critical'))::int high_or_critical,
      count(DISTINCT source)::int source_datasets
    FROM hazard_zones h
    WHERE ${where.join(" AND ")}
  `,params);

  const imports=await query(`
    SELECT i.id,i.source,i.source_date,i.verified_on_import,i.total_features,i.imported_features,
      i.failed_features,i.created_at,u.name created_by_name
    FROM hazard_zone_imports i
    LEFT JOIN users u ON u.id=i.created_by
    ORDER BY i.created_at DESC
    LIMIT 20
  `);

  return NextResponse.json({data:result.rows,summary:summary.rows[0],imports:imports.rows});
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {
    source?:string;
    sourceDate?:string|null;
    verified?:boolean;
    features?:Feature[];
  }|null;

  const source=str(body?.source).slice(0,300);
  const sourceDate=parseDate(body?.sourceDate);
  const verified=Boolean(body?.verified);
  const features=body?.features;

  if(source.length<2)return error("Hazard dataset source / provenance is required.");
  if(sourceDate===undefined)return error("Source date must use YYYY-MM-DD.");
  if(!Array.isArray(features)||!features.length)return error("Provide a GeoJSON FeatureCollection with hazard polygons.");
  if(features.length>1000)return error("Hazard-zone import is limited to 1,000 features per batch.");
  if(JSON.stringify(features).length>20_000_000)return error("Hazard-zone import payload must be 20 MB or smaller.");

  const client=await pool().connect();
  const failures:{row:number;message:string}[]=[];
  let imported=0;

  try{
    await client.query("BEGIN");
    const job=await client.query<{id:string}>(`
      INSERT INTO hazard_zone_imports(source,source_date,verified_on_import,total_features,created_by)
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
    `,[source,sourceDate,verified,features.length,session.sub]);

    for(let i=0;i<features.length;i++){
      const savepoint="hazard_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        const feature=features[i];
        if(feature?.type!=="Feature")throw new Error("Item must be a GeoJSON Feature.");
        if(!feature.geometry||!["Polygon","MultiPolygon"].includes(String(feature.geometry.type))){
          throw new Error("Hazard geometry must be Polygon or MultiPolygon.");
        }
        const p=feature.properties||{};
        const name=str(p.name||p.zoneName||p.zone_name).slice(0,220);
        if(!name)throw new Error("Hazard zone name is required.");

        const hazardType=str(p.hazardType||p.hazard_type||p.type||p.category).toLowerCase();
        if(!isHazardType(hazardType))throw new Error("Invalid hazard type: "+(hazardType||"(missing)"));

        const severity=str(p.severity||"unknown").toLowerCase();
        if(!isHazardSeverity(severity))throw new Error("Invalid hazard severity: "+severity);

        const rowDate=parseDate(p.sourceDate||p.source_date||sourceDate);
        if(rowDate===undefined)throw new Error("Invalid source date; use YYYY-MM-DD.");

        const method=str(p.method||p.mappingMethod||p.mapping_method).slice(0,300)||null;
        const notes=str(p.notes||p.description).slice(0,3000)||null;
        const geo=JSON.stringify(feature.geometry);

        const inserted=await client.query(`
          WITH normalized AS (
            SELECT ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_Force2D(
                    ST_SetSRID(ST_GeomFromGeoJSON($4),4326)
                  )
                ),3
              )
            )::geometry(MultiPolygon,4326) geom
          )
          INSERT INTO hazard_zones(
            name,hazard_type,severity,boundary,source,source_date,method,verified,
            verified_at,verified_by,notes,created_by,updated_by
          )
          SELECT
            $1,$2,$3,n.geom,$5,$6,$7,$8,
            CASE WHEN $8 THEN now() ELSE NULL END,
            CASE WHEN $8 THEN $9::uuid ELSE NULL END,
            $10,$9,$9
          FROM normalized n
          WHERE n.geom IS NOT NULL
            AND NOT ST_IsEmpty(n.geom)
            AND ST_Area(n.geom::geography)>=10
            AND ST_Area(n.geom::geography)<=100000000000
          RETURNING id
        `,[
          name,hazardType,severity,geo,source,rowDate,method,verified,session.sub,notes
        ]);

        if(!inserted.rowCount)throw new Error("Hazard polygon must be valid and between 10 m² and 100,000 km² after normalization.");
        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        failures.push({row:i+1,message:e instanceof Error?e.message:"Hazard-zone import failed."});
      }
    }

    await client.query(`
      UPDATE hazard_zone_imports
      SET imported_features=$1,failed_features=$2,errors=$3
      WHERE id=$4
    `,[imported,failures.length,JSON.stringify(failures.slice(0,100)),job.rows[0].id]);

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'hazard_zone_import','hazard_zone',$2)",
      [session.sub,JSON.stringify({
        source,sourceDate,verified,total:features.length,imported,failed:failures.length,jobId:job.rows[0].id
      })]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{
      jobId:job.rows[0].id,total:features.length,imported,failed:failures.length,errors:failures
    }});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Hazard-zone import failed.",400);
  }finally{
    client.release();
  }
}
