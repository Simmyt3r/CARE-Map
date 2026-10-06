import {query} from "@/lib/db";

export const publicKinds=["boreholes","assets","forest-sites","rivers"] as const;
export type PublicKind=typeof publicKinds[number];

export function isPublicKind(value:string):value is PublicKind{
  return publicKinds.includes(value as PublicKind);
}

export function isPublicResourceId(value:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function singularEntity(kind:PublicKind){
  return kind==="boreholes"?"borehole":kind==="assets"?"asset":kind==="forest-sites"?"forest_site":"river";
}

export async function getPublicResource(kind:PublicKind,id:string){
  let sql="";
  if(kind==="boreholes"){
    sql=`SELECT id,name,borehole_code code,lga_code,status,risk_level,risk_score,description,
      installation_date,last_maintenance_date,gps_accuracy_m,captured_at,capture_source,
      ST_AsGeoJSON(location)::json geometry,ST_Y(location) latitude,ST_X(location) longitude,
      NULL::text subtype
      FROM boreholes WHERE id=$1`;
  }else if(kind==="assets"){
    sql=`SELECT id,name,asset_code code,lga_code,status,risk_level,risk_score,description,
      NULL::date installation_date,last_maintenance_date,gps_accuracy_m,captured_at,capture_source,
      ST_AsGeoJSON(location)::json geometry,ST_Y(location) latitude,ST_X(location) longitude,
      asset_type subtype
      FROM assets WHERE id=$1`;
  }else if(kind==="forest-sites"){
    sql=`SELECT id,name,NULL::text code,lga_code,status,risk_level,risk_score,description,
      NULL::date installation_date,NULL::date last_maintenance_date,NULL::numeric gps_accuracy_m,
      NULL::timestamptz captured_at,NULL::text capture_source,
      ST_AsGeoJSON(boundary)::json geometry,
      ST_Y(ST_PointOnSurface(boundary)) latitude,ST_X(ST_PointOnSurface(boundary)) longitude,
      site_type subtype
      FROM forest_sites WHERE id=$1`;
  }else{
    sql=`SELECT id,COALESCE(name,local_name,'Unnamed river') name,NULL::text code,lga_code,
      stress_indicator status,risk_level,risk_score,description,
      NULL::date installation_date,NULL::date last_maintenance_date,NULL::numeric gps_accuracy_m,
      NULL::timestamptz captured_at,source capture_source,
      ST_AsGeoJSON(course)::json geometry,
      ST_Y(ST_PointOnSurface(course)) latitude,ST_X(ST_PointOnSurface(course)) longitude,
      source subtype
      FROM rivers WHERE id=$1 AND verified=TRUE`;
  }

  const result=await query(sql,[id]);
  const row=result.rows[0];
  if(!row)return null;

  const entityType=singularEntity(kind);
  const [photos,inspection,maintenance]=await Promise.all([
    query("SELECT id,url,caption,uploaded_at FROM photos WHERE entity_type=$1 AND entity_id=$2 ORDER BY uploaded_at DESC LIMIT 20",[entityType,id]),
    query(
      "SELECT count(*)::int total,max(inspected_at) last_inspected_at,(SELECT condition FROM inspections i2 WHERE i2.entity_type=$1 AND i2.entity_id=$2 ORDER BY inspected_at DESC LIMIT 1) last_condition FROM inspections WHERE entity_type=$1 AND entity_id=$2",
      [entityType,id]
    ),
    (kind==="boreholes"||kind==="assets")
      ?query("SELECT count(*)::int total,max(performed_at) last_performed_at FROM maintenance_records WHERE entity_type=$1 AND entity_id=$2",[entityType,id])
      :Promise.resolve({rows:[{total:0,last_performed_at:null}]})
  ]);

  return{
    ...row,
    kind,
    entityType,
    photos:photos.rows,
    inspectionSummary:inspection.rows[0]||{total:0,last_inspected_at:null,last_condition:null},
    maintenanceSummary:maintenance.rows[0]||{total:0,last_performed_at:null}
  };
}
