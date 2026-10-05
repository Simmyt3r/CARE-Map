import {query} from "@/lib/db";
export const resourceKinds=["boreholes","assets","forest-sites","rivers"] as const;
export type ResourceKind=typeof resourceKinds[number];
export function isResourceKind(v:string):v is ResourceKind{return resourceKinds.includes(v as ResourceKind);}
export async function listResources(kind:ResourceKind,filters:{lga?:string|null;status?:string|null;includeUnverified?:boolean}={}){
 const where:string[]=[];const params:unknown[]=[];
 const add=(sql:string,value:unknown)=>{params.push(value);where.push(sql.replace("?","$"+params.length));};
 if(filters.lga)add("lga_code = ?",filters.lga);if(filters.status&&kind!=="rivers")add("status = ?",filters.status);if(kind==="rivers"&&!filters.includeUnverified)where.push("verified = TRUE");
 const table=kind==="forest-sites"?"forest_sites":kind;const geom=kind==="boreholes"||kind==="assets"?"location":kind==="forest-sites"?"boundary":"course";
 const r=await query(`SELECT *,ST_AsGeoJSON(${geom})::json AS geometry FROM ${table} ${where.length?"WHERE "+where.join(" AND "):""} ORDER BY created_at DESC LIMIT 500`,params);return r.rows;
}
export async function createResource(kind:ResourceKind,body:Record<string,unknown>,actorId:string){
 if(kind==="boreholes"){const{name,lgaCode,latitude,longitude,status,installationDate,lastMaintenanceDate,description}=body;return(await query("INSERT INTO boreholes(name,lga_code,location,status,installation_date,last_maintenance_date,description,created_by,updated_by) VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),$5,$6,$7,$8,$9,$9) RETURNING id",[name,lgaCode,longitude,latitude,status,installationDate||null,lastMaintenanceDate||null,description||null,actorId])).rows[0];}
 if(kind==="assets"){const{name,assetType,lgaCode,latitude,longitude,status,lastMaintenanceDate,description}=body;return(await query("INSERT INTO assets(name,asset_type,lga_code,location,status,last_maintenance_date,description,created_by,updated_by) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,$8,$9,$9) RETURNING id",[name,assetType,lgaCode,longitude,latitude,status,lastMaintenanceDate||null,description||null,actorId])).rows[0];}
 if(kind==="forest-sites"){const{name,lgaCode,geometry,siteType,status,description}=body;return(await query("INSERT INTO forest_sites(name,lga_code,boundary,site_type,status,description,created_by,updated_by) VALUES($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6,$7,$7) RETURNING id",[name,lgaCode,JSON.stringify(geometry),siteType,status||"healthy",description||null,actorId])).rows[0];}
 const{name,localName,lgaCode,geometry,source,description,verified}=body;return(await query("INSERT INTO rivers(name,local_name,lga_code,course,source,description,verified,created_by,updated_by) VALUES($1,$2,$3,ST_SetSRID(ST_GeomFromGeoJSON($4),4326),$5,$6,$7,$8,$8) RETURNING id",[name||null,localName||null,lgaCode,JSON.stringify(geometry),source||"official",description||null,Boolean(verified??true),actorId])).rows[0];
}
export async function patchResource(kind:ResourceKind,id:string,body:Record<string,unknown>,actorId:string){
 const allowed:Record<ResourceKind,Record<string,string>>={boreholes:{name:"name",lgaCode:"lga_code",status:"status",installationDate:"installation_date",lastMaintenanceDate:"last_maintenance_date",description:"description"},assets:{name:"name",assetType:"asset_type",lgaCode:"lga_code",status:"status",lastMaintenanceDate:"last_maintenance_date",description:"description"},"forest-sites":{name:"name",lgaCode:"lga_code",siteType:"site_type",status:"status",description:"description"},rivers:{name:"name",localName:"local_name",lgaCode:"lga_code",source:"source",description:"description",verified:"verified",stressIndicator:"stress_indicator"}};
 const table=kind==="forest-sites"?"forest_sites":kind;const sets:string[]=[];const params:unknown[]=[];
 for(const[key,column]of Object.entries(allowed[kind]))if(Object.prototype.hasOwnProperty.call(body,key)){params.push(body[key]);sets.push(`${column}=$${params.length}`);}
 if(Object.prototype.hasOwnProperty.call(body,"latitude")&&Object.prototype.hasOwnProperty.call(body,"longitude")&&(kind==="boreholes"||kind==="assets")){params.push(body.longitude,body.latitude);sets.push(`location=ST_SetSRID(ST_MakePoint($${params.length-1},$${params.length}),4326)`);}
 if(Object.prototype.hasOwnProperty.call(body,"geometry")&&(kind==="forest-sites"||kind==="rivers")){params.push(JSON.stringify(body.geometry));sets.push(`${kind==="forest-sites"?"boundary":"course"}=ST_SetSRID(ST_GeomFromGeoJSON($${params.length}),4326)`);}
 if(!sets.length)return null;params.push(actorId,id);sets.push(`updated_by=$${params.length-1}`);const r=await query(`UPDATE ${table} SET ${sets.join(",")} WHERE id=$${params.length} RETURNING id`,params);return r.rows[0]||null;
}
