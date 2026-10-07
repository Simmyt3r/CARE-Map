import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool,query} from "@/lib/db";
import {isBoundaryGeometry,lgaFeatureCandidates,normalizeLgaToken,type LgaBoundaryFeature} from "@/lib/lga-boundaries";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const result=await query(`
    SELECT code,name,pilot,boundary_source,boundary_updated_at,
      CASE WHEN boundary IS NULL THEN NULL ELSE round((ST_Area(boundary::geography)/1000000.0)::numeric,2) END area_km2,
      CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END geometry
    FROM lgas ORDER BY name
  `);
  const mapped=result.rows.filter((r:any)=>r.geometry);
  const missing=result.rows.filter((r:any)=>!r.geometry).map((r:any)=>({code:r.code,name:r.name,pilot:r.pilot}));
  return NextResponse.json({
    type:"FeatureCollection",
    features:mapped.map((r:any)=>({
      type:"Feature",
      id:r.code,
      geometry:r.geometry,
      properties:{
        code:r.code,name:r.name,pilot:r.pilot,areaKm2:r.area_km2,
        source:r.boundary_source,updatedAt:r.boundary_updated_at
      }
    })),
    summary:{total:result.rowCount,mapped:mapped.length,missing:missing.length},
    missing
  });
}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");

  const body=await request.json().catch(()=>null) as {source?:string;features?:LgaBoundaryFeature[]}|null;
  const source=String(body?.source||"").trim().slice(0,300);
  const features=body?.features;
  if(!source)return error("Boundary source / provenance is required.");
  if(!Array.isArray(features)||!features.length)return error("Provide GeoJSON polygon features.");
  if(features.length>100)return error("Boundary import is limited to 100 features per batch.");

  const client=await pool().connect();
  const failures:{row:number;message:string}[]=[];
  let imported=0;

  try{
    await client.query("BEGIN");
    const lgaResult=await client.query<{code:string;name:string}>("SELECT code,name FROM lgas ORDER BY name");
    const byCode=new Map(lgaResult.rows.map(x=>[normalizeLgaToken(x.code),x]));
    const byName=new Map(lgaResult.rows.map(x=>[normalizeLgaToken(x.name),x]));

    const job=await client.query<{id:string}>(
      "INSERT INTO lga_boundary_imports(source,total_features,created_by) VALUES($1,$2,$3) RETURNING id",
      [source,features.length,session.sub]
    );

    for(let i=0;i<features.length;i++){
      const savepoint="boundary_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        const feature=features[i];
        if(!feature||feature.type!=="Feature")throw new Error("Item must be a GeoJSON Feature.");
        if(!feature.geometry||!isBoundaryGeometry(feature.geometry.type))throw new Error("Geometry must be Polygon or MultiPolygon.");

        const candidates=lgaFeatureCandidates(feature);
        let match:{code:string;name:string}|undefined;
        for(const code of candidates.codes){match=byCode.get(code);if(match)break;}
        if(!match){for(const name of candidates.names){match=byName.get(name);if(match)break;}}
        if(!match)throw new Error("Could not match feature to a CARE-Map LGA. Include code/lga_code or a recognized LGA name.");

        const geo=JSON.stringify(feature.geometry);
        const updated=await client.query<{code:string;area_km2:number|string}>(`
          WITH normalized AS (
            SELECT ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_Force2D(
                    ST_SetSRID(ST_GeomFromGeoJSON($2),4326)
                  )
                ),3
              )
            )::geometry(MultiPolygon,4326) geom
          )
          UPDATE lgas l SET
            boundary=n.geom,
            boundary_source=$3,
            boundary_updated_at=now(),
            boundary_imported_by=$4
          FROM normalized n
          WHERE l.code=$1
            AND n.geom IS NOT NULL
            AND NOT ST_IsEmpty(n.geom)
            AND ST_Area(n.geom::geography)>1000000
          RETURNING l.code,ST_Area(l.boundary::geography)/1000000.0 area_km2
        `,[match.code,geo,source,session.sub]);

        if(!updated.rowCount)throw new Error("Boundary geometry was empty or smaller than 1 km² after validation.");
        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        failures.push({row:i+1,message:e instanceof Error?e.message:"Boundary import failed"});
      }
    }

    await client.query(
      "UPDATE lga_boundary_imports SET imported_features=$1,failed_features=$2,errors=$3 WHERE id=$4",
      [imported,failures.length,JSON.stringify(failures.slice(0,100)),job.rows[0].id]
    );
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'lga_boundary_import','lga',$2)",
      [session.sub,JSON.stringify({source,total:features.length,imported,failed:failures.length,jobId:job.rows[0].id})]
    );
    await client.query("COMMIT");

    return NextResponse.json({data:{
      jobId:job.rows[0].id,total:features.length,imported,failed:failures.length,errors:failures
    }});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"LGA boundary import failed.",400);
  }finally{
    client.release();
  }
}
