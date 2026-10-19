import {NextResponse} from "next/server";
import {parseBbox} from "@/lib/http";
import {query} from "@/lib/db";
import {deploymentProfile} from "@/lib/deployment-profile";
import {safePublicMapImageUrl,publicMapCaption} from "@/lib/public-map-images";

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
  change_ha?:number|string|null;
  change_pct?:number|string|null;
  change_direction?:"gain"|"loss"|"stable"|null;
  baseline_date?:string|null;
  comparison_date?:string|null;
  lga_names?:string[]|null;
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
    const clauses=["r.status='completed'","r.publish_to_map=TRUE",
      "r.baseline_clear_fraction>=r.minimum_clear_fraction",
      "r.comparison_clear_fraction>=r.minimum_clear_fraction",
      "r.baseline_vegetation_ha IS NOT NULL","r.comparison_vegetation_ha IS NOT NULL"];
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
        r.change_level risk_level,
        r.vegetation_change_ha change_ha,
        r.vegetation_change_pct change_pct,
        CASE WHEN r.vegetation_change_ha>0 THEN 'gain'
             WHEN r.vegetation_change_ha<0 THEN 'loss'
             ELSE 'stable' END change_direction,
        r.baseline_date baseline_date,r.comparison_date comparison_date,
        ARRAY(
          SELECT lg.name FROM lgas lg
          WHERE lg.boundary IS NOT NULL AND lg.boundary && r.aoi
            AND ST_Intersects(lg.boundary,r.aoi) AND NOT ST_Touches(lg.boundary,r.aoi)
          ORDER BY lg.name LIMIT 25
        ) AS lga_names
      FROM remote_sensing_analyses r
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.completed_at DESC
      LIMIT 500
    `,params);
    rows.push(...result.rows);
  }

  // Photos already appear in the existing public resource-detail gallery.
  // Fetch only the newest image of each *visible public resource* in one batch.
  // Never read community reports or staff-only extension evidence.
  const resourceRows=rows.filter(r=>["borehole","asset","forest_site","river"].includes(r.entity_type));
  const primaryPhotos=new Map<string,{url:string;caption:string|null}>();
  if(resourceRows.length){
    try{
      const photos=await query<{
        entity_type:string;entity_id:string;url:string;caption:string|null;
      }>(`
        SELECT DISTINCT ON (entity_type,entity_id)
          entity_type,entity_id::text,url,caption
        FROM photos
        WHERE entity_type=ANY($1::text[]) AND entity_id=ANY($2::uuid[])
        ORDER BY entity_type,entity_id,uploaded_at DESC
      `,[
        ["borehole","asset","forest_site","river"],
        resourceRows.map(r=>r.id)
      ]);
      for(const photo of photos.rows){
        const safeUrl=safePublicMapImageUrl(photo.url);
        if(safeUrl)primaryPhotos.set(photo.entity_type+":"+photo.entity_id,
          {url:safeUrl,caption:publicMapCaption(photo.caption)});
      }
    }catch{
      // A photo lookup should never make a working geographic map unavailable.
      console.warn("Public map images could not be loaded.");
    }
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
        riskLevel:r.risk_level,
        ...(primaryPhotos.has(r.entity_type+":"+r.id)
          ?{
            imageUrl:primaryPhotos.get(r.entity_type+":"+r.id)!.url,
            imageCaption:primaryPhotos.get(r.entity_type+":"+r.id)!.caption
          }:{}),
        ...(r.entity_type==="ndvi_change"?{
          changeHa:r.change_ha==null?null:Number(r.change_ha),
          changePct:r.change_pct==null?null:Number(r.change_pct),
          changeDirection:r.change_direction,
          baselineDate:r.baseline_date?String(r.baseline_date).slice(0,10):null,
          comparisonDate:r.comparison_date?String(r.comparison_date).slice(0,10):null,
          lgaNames:r.lga_names||[],
          stateName:r.lga_names?.length?deploymentProfile.stateName:null
        }:{})
      }
    }))
  },{headers:{"Cache-Control":"public, max-age=0, s-maxage=20, stale-while-revalidate=40"}});
}
