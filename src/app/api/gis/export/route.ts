import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {query} from "@/lib/db";

const kinds=new Set(["all","boreholes","assets","forest-sites","rivers"]);

function csvCell(value:unknown){
  const s=value==null?"":typeof value==="object"?JSON.stringify(value):String(value);
  return '"'+s.replaceAll('"','""')+'"';
}

export async function GET(request:Request){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const url=new URL(request.url);
  const format=url.searchParams.get("format")||"geojson";
  const kind=url.searchParams.get("kind")||"all";
  if(!kinds.has(kind))return error("Invalid resource kind");

  const filters:string[]=[];
  const params:unknown[]=[];
  if(kind!=="all"){params.push(kind);filters.push("entity_kind=$1");}
  const result=await query(`
    SELECT * FROM (
      SELECT 'boreholes' entity_kind,id,name,lga_code,status,borehole_code code,gps_accuracy_m,captured_at,capture_source,ST_AsGeoJSON(location)::json geometry,description,created_at FROM boreholes
      UNION ALL
      SELECT 'assets',id,name,lga_code,status,asset_code,gps_accuracy_m,captured_at,capture_source,ST_AsGeoJSON(location)::json,description,created_at FROM assets
      UNION ALL
      SELECT 'forest-sites',id,name,lga_code,status,NULL,NULL,NULL,NULL,ST_AsGeoJSON(boundary)::json,description,created_at FROM forest_sites
      UNION ALL
      SELECT 'rivers',id,COALESCE(name,local_name),lga_code,stress_indicator,NULL,NULL,NULL,source,ST_AsGeoJSON(course)::json,description,created_at FROM rivers
    ) x ${filters.length?"WHERE "+filters.join(" AND "):""}
    ORDER BY entity_kind,lga_code,name
  `,params);

  if(format==="csv"){
    const headers=["entity_kind","id","name","lga_code","status","code","gps_accuracy_m","captured_at","capture_source","geometry","description","created_at"];
    const csv=[headers.join(","),...result.rows.map(r=>headers.map(h=>csvCell(r[h])).join(","))].join("\n");
    return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=care-map-gis-export.csv"}});
  }
  const fc={type:"FeatureCollection",features:result.rows.map(r=>({type:"Feature",id:r.id,geometry:r.geometry,properties:{entityKind:r.entity_kind,name:r.name,lgaCode:r.lga_code,status:r.status,code:r.code,gpsAccuracy:r.gps_accuracy_m,capturedAt:r.captured_at,captureSource:r.capture_source,description:r.description,createdAt:r.created_at}}))};
  return new Response(JSON.stringify(fc),{headers:{"content-type":"application/geo+json","content-disposition":"attachment; filename=care-map-export.geojson"}});
}
