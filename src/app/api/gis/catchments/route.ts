import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {isCatchmentLevel,normalizeCatchmentCode} from "@/lib/catchments";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Feature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown}|null;
  properties?:Record<string,unknown>;
};

function str(value:unknown){return value==null?"":String(value).trim();}

function parseDate(value:unknown){
  const raw=str(value);
  if(!raw)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return undefined;
  const date=new Date(raw+"T00:00:00Z");
  if(Number.isNaN(date.getTime()))return undefined;
  return date.toISOString().slice(0,10)===raw?raw:undefined;
}

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const url=new URL(request.url);
  const level=str(url.searchParams.get("level")).toLowerCase();
  const lga=str(url.searchParams.get("lga")).toUpperCase();
  const verifiedValue=url.searchParams.get("verified");
  const format=str(url.searchParams.get("format")).toLowerCase();

  if(level&&!isCatchmentLevel(level))return error("Invalid catchment level.");

  const where:string[]=["TRUE"];
  const params:unknown[]=[];
  if(level){params.push(level);where.push("c.catchment_level=$"+params.length);}
  if(lga){
    params.push(lga);const n=params.length;
    where.push("EXISTS(SELECT 1 FROM lgas l WHERE l.code=$"+n+" AND l.boundary IS NOT NULL AND ST_Intersects(c.boundary,l.boundary) AND ST_Area(ST_Intersection(c.boundary,l.boundary)::geography)>1000)");
  }
  if(verifiedValue==="1"||verifiedValue==="true")where.push("c.verified=TRUE");
  if(verifiedValue==="0"||verifiedValue==="false")where.push("c.verified=FALSE");

  if(format==="geojson"){
    const result=await query(`
      SELECT c.id,c.catchment_code,c.name,c.catchment_level,c.parent_id,c.source,c.source_date,c.method,
        c.verified,c.notes,ST_AsGeoJSON(c.boundary)::json geometry
      FROM catchments c
      WHERE ${where.join(" AND ")}
      ORDER BY c.catchment_level,c.name
      LIMIT 2000
    `,params);
    return NextResponse.json({
      type:"FeatureCollection",
      features:result.rows.map((r:any)=>({
        type:"Feature",id:r.id,geometry:r.geometry,
        properties:{
          id:r.id,code:r.catchment_code,name:r.name,level:r.catchment_level,parentId:r.parent_id,
          source:r.source,sourceDate:r.source_date,method:r.method,verified:r.verified,notes:r.notes
        }
      }))
    });
  }

  const result=await query(`
    SELECT c.id,c.catchment_code,c.name,c.catchment_level,c.parent_id,
      p.name parent_name,c.source,c.source_date,c.method,c.verified,c.verified_at,
      c.notes,c.created_at,c.updated_at,u.name verified_by_name,
      round((ST_Area(c.boundary::geography)/1000000.0)::numeric,3) area_km2,
      ST_Y(ST_PointOnSurface(c.boundary)) latitude,
      ST_X(ST_PointOnSurface(c.boundary)) longitude
    FROM catchments c
    LEFT JOIN catchments p ON p.id=c.parent_id
    LEFT JOIN users u ON u.id=c.verified_by
    WHERE ${where.join(" AND ")}
    ORDER BY c.verified DESC,c.catchment_level,c.name
    LIMIT 500
  `,params);

  const summary=await query(`
    SELECT count(*)::int total,
      count(*) FILTER(WHERE verified)::int verified,
      count(*) FILTER(WHERE NOT verified)::int unverified,
      count(DISTINCT source)::int source_datasets,
      count(*) FILTER(WHERE catchment_level='watershed')::int watersheds,
      count(*) FILTER(WHERE catchment_level='subcatchment')::int subcatchments
    FROM catchments c
    WHERE ${where.join(" AND ")}
  `,params);

  const imports=await query(`
    SELECT i.id,i.source,i.source_date,i.verified_on_import,i.total_features,i.imported_features,
      i.failed_features,i.created_at,u.name created_by_name
    FROM catchment_imports i
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
    source?:string;sourceDate?:string|null;verified?:boolean;features?:Feature[];
  }|null;

  const source=str(body?.source).slice(0,300);
  const sourceDate=parseDate(body?.sourceDate);
  const verified=Boolean(body?.verified);
  const features=body?.features;

  if(source.length<2)return error("Catchment dataset source / provenance is required.");
  if(sourceDate===undefined)return error("Source date must use YYYY-MM-DD.");
  if(!Array.isArray(features)||!features.length)return error("Provide a GeoJSON FeatureCollection with catchment polygons.");
  if(features.length>1000)return error("Catchment import is limited to 1,000 features per batch.");
  if(JSON.stringify(features).length>20_000_000)return error("Catchment import payload must be 20 MB or smaller.");

  const client=await pool().connect();
  const failures:{row:number;message:string}[]=[];
  const batchCodes=new Set<string>();
  let imported=0;

  try{
    await client.query("BEGIN");
    const job=await client.query<{id:string}>(`
      INSERT INTO catchment_imports(source,source_date,verified_on_import,total_features,created_by)
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
    `,[source,sourceDate,verified,features.length,session.sub]);

    for(let i=0;i<features.length;i++){
      const savepoint="catchment_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        const feature=features[i];
        if(feature?.type!=="Feature")throw new Error("Item must be a GeoJSON Feature.");
        if(!feature.geometry||!["Polygon","MultiPolygon"].includes(String(feature.geometry.type))){
          throw new Error("Catchment geometry must be Polygon or MultiPolygon.");
        }

        const p=feature.properties||{};
        const name=str(p.name||p.catchmentName||p.catchment_name||p.watershedName||p.watershed_name).slice(0,220);
        if(!name)throw new Error("Catchment name is required.");

        const level=str(p.catchmentLevel||p.catchment_level||p.level||p.type||"watershed").toLowerCase();
        if(!isCatchmentLevel(level))throw new Error("Invalid catchment level: "+level);

        const code=normalizeCatchmentCode(p.catchmentCode||p.catchment_code||p.code||p.id);
        if(code){
          if(batchCodes.has(code))throw new Error("Duplicate catchment code in this import batch: "+code);
          const exists=await client.query("SELECT 1 FROM catchments WHERE catchment_code=$1 LIMIT 1",[code]);
          if(exists.rowCount)throw new Error("Catchment code already exists: "+code);
        }

        const rowDate=parseDate(p.sourceDate||p.source_date||sourceDate);
        if(rowDate===undefined)throw new Error("Invalid source date; use YYYY-MM-DD.");

        const method=str(p.method||p.delineationMethod||p.delineation_method).slice(0,300)||null;
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
          INSERT INTO catchments(
            catchment_code,name,catchment_level,boundary,source,source_date,method,verified,
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
            AND ST_Area(n.geom::geography)>=1000
            AND ST_Area(n.geom::geography)<=500000000000
          RETURNING id
        `,[code,name,level,geo,source,rowDate,method,verified,session.sub,notes]);

        if(!inserted.rowCount)throw new Error("Catchment polygon must be valid and between 0.001 km² and 500,000 km² after normalization.");
        if(code)batchCodes.add(code);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        failures.push({row:i+1,message:e instanceof Error?e.message:"Catchment import failed."});
      }
    }

    await client.query(`
      UPDATE catchment_imports
      SET imported_features=$1,failed_features=$2,errors=$3
      WHERE id=$4
    `,[imported,failures.length,JSON.stringify(failures.slice(0,100)),job.rows[0].id]);

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'catchment_import','catchment',$2)",
      [session.sub,JSON.stringify({
        source,sourceDate,verified,total:features.length,imported,failed:failures.length,jobId:job.rows[0].id
      })]
    );

    await client.query("COMMIT");
    return NextResponse.json({data:{jobId:job.rows[0].id,total:features.length,imported,failed:failures.length,errors:failures}});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Catchment import failed.",400);
  }finally{
    client.release();
  }
}
