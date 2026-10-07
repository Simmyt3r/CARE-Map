import {NextResponse} from "next/server";
import {parseBbox} from "@/lib/http";
import {query} from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type FeatureRow={
  id:string;
  entity_type:string;
  name:string|null;
  lga_code:string|null;
  status:string|null;
  geometry:unknown;
  risk_level:string|null;
};

export async function GET(request:Request){
  const url=new URL(request.url);
  const bbox=parseBbox(url.searchParams.get("bbox"));
  const type=url.searchParams.get("type");
  const lga=url.searchParams.get("lga");
  const status=url.searchParams.get("status");
  const baseParams:unknown[]=bbox?[bbox.minLng,bbox.minLat,bbox.maxLng,bbox.maxLat]:[];
  const rows:FeatureRow[]=[];

  const configs=[
    ["borehole","boreholes","location","name","status","TRUE"],
    ["asset","assets","location","name","status","TRUE"],
    ["forest_site","forest_sites","boundary","name","status","TRUE"],
    ["river","rivers","course","COALESCE(name,local_name)","stress_indicator","verified=TRUE"]
  ] as const;

  for(const[entityType,table,geom,nameExpr,statusExpr,visibility]of configs){
    if(type&&type!==entityType)continue;
    const clauses:string[]=[visibility];
    const params:unknown[]=[...baseParams];
    if(bbox)clauses.push("ST_Intersects("+geom+",ST_MakeEnvelope($1,$2,$3,$4,4326))");
    if(lga){params.push(lga);clauses.push("lga_code=$"+params.length);}
    if(status){params.push(status);clauses.push(statusExpr+"=$"+params.length);}
    const sql=
      "SELECT id,'"+entityType+"' entity_type,"+nameExpr+" name,lga_code,"+statusExpr+
      " status,ST_AsGeoJSON("+geom+")::json geometry,risk_level FROM "+table+
      " WHERE "+clauses.join(" AND ")+" LIMIT 1500";
    const result=await query<FeatureRow>(sql,params);
    rows.push(...result.rows);
  }

  if((!type||type==="ndvi_change")&&!status){
    const clauses=["r.status='completed'","r.publish_to_map=TRUE"];
    const params:unknown[]=[...baseParams];
    if(bbox)clauses.push("ST_Intersects(r.aoi,ST_MakeEnvelope($1,$2,$3,$4,4326))");

    let lgaSelect="NULL::text";
    if(lga){
      params.push(lga);
      const lgaParam=params.length;
      lgaSelect="$"+lgaParam+"::text";
      clauses.push(
        "EXISTS(SELECT 1 FROM lgas lg WHERE lg.code=$"+lgaParam+
        " AND lg.boundary IS NOT NULL AND ST_Intersects(r.aoi,lg.boundary))"
      );
    }

    const result=await query<FeatureRow>(`
      SELECT r.id,'ndvi_change' entity_type,r.name,${lgaSelect} lga_code,
        concat(
          round(COALESCE(r.vegetation_change_ha,0)::numeric,1),
          ' ha / ',
          round(COALESCE(r.vegetation_change_pct,0)::numeric,1),
          '%'
        ) status,
        ST_AsGeoJSON(r.aoi)::json geometry,
        r.change_level risk_level
      FROM remote_sensing_analyses r
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.completed_at DESC
      LIMIT 500
    `,params);
    rows.push(...result.rows);
  }

  return NextResponse.json({
    type:"FeatureCollection",
    features:rows.map(r=>({
      type:"Feature",
      id:r.id,
      geometry:r.geometry,
      properties:{
        id:r.id,
        entityType:r.entity_type,
        name:r.name,
        lga:r.lga_code,
        status:r.status,
        riskLevel:r.risk_level
      }
    }))
  });
}
