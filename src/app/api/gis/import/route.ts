import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";

type Row=Record<string,unknown>;
type Feature={type?:string;geometry?:{type?:string;coordinates?:unknown};properties?:Record<string,unknown>};
const allowedKinds=new Set(["boreholes","assets","forest-sites","rivers"]);

function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null;}
function str(v:unknown){return v==null?"":String(v).trim();}

export async function POST(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const body=await request.json().catch(()=>null) as {kind?:string;format?:string;rows?:Row[];features?:Feature[]}|null;
  const kind=str(body?.kind),format=str(body?.format);
  if(!allowedKinds.has(kind))return error("Invalid import resource type.");
  if(format!=="csv"&&format!=="geojson")return error("Import format must be csv or geojson.");

  const items=format==="csv"?(body?.rows||[]):(body?.features||[]);
  if(!Array.isArray(items)||!items.length)return error("No import rows were provided.");
  if(items.length>1000)return error("Import is limited to 1,000 records per batch.");

  const client=await pool().connect();
  const errors:{row:number;message:string}[]=[];
  let imported=0;
  try{
    await client.query("BEGIN");
    const lgaRows=await client.query<{code:string}>("SELECT code FROM lgas");
    const lgas=new Set(lgaRows.rows.map(x=>x.code));
    const job=await client.query<{id:string}>(
      "INSERT INTO import_jobs(kind,format,total_rows,created_by) VALUES($1,$2,$3,$4) RETURNING id",
      [kind,format,items.length,session.sub]
    );

    for(let i=0;i<items.length;i++){
      const savepoint="row_"+i;
      await client.query("SAVEPOINT "+savepoint);
      try{
        if(format==="csv"){
          const row=items[i] as Row;
          if(kind!=="boreholes"&&kind!=="assets")throw new Error("CSV import currently supports point resources: boreholes and assets.");
          const name=str(row.name);
          const lgaCode=str(row.lgaCode||row.lga_code).toUpperCase();
          const latitude=num(row.latitude);
          const longitude=num(row.longitude);
          const status=str(row.status)||"functional";
          if(!name)throw new Error("name is required");
          if(!lgas.has(lgaCode))throw new Error("Unknown LGA code: "+lgaCode);
          if(latitude==null||latitude< -90||latitude>90)throw new Error("Invalid latitude");
          if(longitude==null||longitude< -180||longitude>180)throw new Error("Invalid longitude");
          if(kind==="boreholes"){
            await client.query(
              "INSERT INTO boreholes(name,lga_code,location,status,borehole_code,description,gps_accuracy_m,captured_at,capture_source,created_by,updated_by) VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),$5,$6,$7,$8,$9,'csv_import',$10,$10)",
              [name,lgaCode,longitude,latitude,status,str(row.boreholeCode||row.code)||null,str(row.description)||null,num(row.gpsAccuracy||row.gps_accuracy_m),str(row.capturedAt||row.captured_at)||null,session.sub]
            );
          }else{
            await client.query(
              "INSERT INTO assets(name,asset_type,lga_code,location,status,asset_code,description,gps_accuracy_m,captured_at,capture_source,created_by,updated_by) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,$8,$9,$10,'csv_import',$11,$11)",
              [name,str(row.assetType||row.asset_type)||"Unspecified",lgaCode,longitude,latitude,status,str(row.assetCode||row.code)||null,str(row.description)||null,num(row.gpsAccuracy||row.gps_accuracy_m),str(row.capturedAt||row.captured_at)||null,session.sub]
            );
          }
        }else{
          const feature=items[i] as Feature;
          const p=feature.properties||{};
          const geometry=feature.geometry;
          if(!geometry?.type)throw new Error("Feature geometry is required");
          const allowedGeometry:Record<string,string[]>={
            boreholes:["Point"],assets:["Point"],"forest-sites":["Polygon","MultiPolygon"],rivers:["LineString","MultiLineString"]
          };
          if(!allowedGeometry[kind].includes(geometry.type))throw new Error("Invalid geometry type "+geometry.type+" for "+kind);
          const lgaCode=str(p.lgaCode||p.lga_code).toUpperCase();
          if(!lgas.has(lgaCode))throw new Error("Unknown LGA code: "+lgaCode);
          const geo=JSON.stringify(geometry);
          if(kind==="boreholes"){
            await client.query(
              "INSERT INTO boreholes(name,lga_code,location,status,borehole_code,description,gps_accuracy_m,captured_at,capture_source,created_by,updated_by) VALUES($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6,$7,$8,'geojson_import',$9,$9)",
              [str(p.name)||"Imported borehole",lgaCode,geo,str(p.status)||"functional",str(p.boreholeCode||p.code)||null,str(p.description)||null,num(p.gpsAccuracy),str(p.capturedAt)||null,session.sub]
            );
          }else if(kind==="assets"){
            await client.query(
              "INSERT INTO assets(name,asset_type,lga_code,location,status,asset_code,description,gps_accuracy_m,captured_at,capture_source,created_by,updated_by) VALUES($1,$2,$3,ST_SetSRID(ST_GeomFromGeoJSON($4),4326),$5,$6,$7,$8,$9,'geojson_import',$10,$10)",
              [str(p.name)||"Imported asset",str(p.assetType)||"Unspecified",lgaCode,geo,str(p.status)||"functional",str(p.assetCode||p.code)||null,str(p.description)||null,num(p.gpsAccuracy),str(p.capturedAt)||null,session.sub]
            );
          }else if(kind==="forest-sites"){
            await client.query(
              "INSERT INTO forest_sites(name,lga_code,boundary,site_type,status,description,created_by,updated_by) VALUES($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6,$7,$7)",
              [str(p.name)||"Imported forest site",lgaCode,geo,str(p.siteType)||"afforestation_site",str(p.status)||"healthy",str(p.description)||null,session.sub]
            );
          }else{
            await client.query(
              "INSERT INTO rivers(name,local_name,lga_code,course,source,description,verified,created_by,updated_by) VALUES($1,$2,$3,ST_SetSRID(ST_GeomFromGeoJSON($4),4326),$5,$6,$7,$8,$8)",
              [str(p.name)||null,str(p.localName)||null,lgaCode,geo,str(p.source)||"official",str(p.description)||null,Boolean(p.verified??true),session.sub]
            );
          }
        }
        await client.query("RELEASE SAVEPOINT "+savepoint);
        imported++;
      }catch(e){
        await client.query("ROLLBACK TO SAVEPOINT "+savepoint);
        await client.query("RELEASE SAVEPOINT "+savepoint);
        errors.push({row:i+1,message:e instanceof Error?e.message:"Import failed"});
      }
    }

    await client.query(
      "UPDATE import_jobs SET imported_rows=$1,failed_rows=$2,errors=$3 WHERE id=$4",
      [imported,errors.length,JSON.stringify(errors.slice(0,100)),job.rows[0].id]
    );
    await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,metadata) VALUES($1,'bulk_import',$2,$3)",[
      session.sub,kind,JSON.stringify({format,total:items.length,imported,failed:errors.length,jobId:job.rows[0].id})
    ]);
    await client.query("COMMIT");
    return NextResponse.json({data:{jobId:job.rows[0].id,total:items.length,imported,failed:errors.length,errors}});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Import failed.",400);
  }finally{
    client.release();
  }
}
