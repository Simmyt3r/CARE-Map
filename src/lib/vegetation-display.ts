import {geometryExtent} from "@/lib/geojson";

export type PublishedVegetationFeature={
  type:"Feature";
  id?:string;
  geometry:{type:string;coordinates:unknown};
  properties:{
    id?:string;entityType?:string;name?:string|null;
    changeHa?:number|null;changePct?:number|null;
    changeDirection?:"gain"|"loss"|"stable"|null;
    baselineDate?:string|null;comparisonDate?:string|null;
    lgaNames?:string[];stateName?:string|null;
  };
};

export function vegetationSummary(item:PublishedVegetationFeature){
  const p=item.properties||{};
  const ha=p.changeHa==null?null:Number(p.changeHa);
  const pct=p.changePct==null?null:Number(p.changePct);
  const direction=ha===null||!Number.isFinite(ha)?"unknown":
    ha>0?"gain":ha<0?"loss":"stable";
  const metric=ha==null||!Number.isFinite(ha)?"Change unavailable":
    (ha>0?"+":"")+ha.toLocaleString("en-NG",{maximumFractionDigits:1})+" ha";
  const percentage=pct==null||!Number.isFinite(pct)?null:
    (pct>0?"+":"")+pct.toFixed(1)+"%";
  const extent=geometryExtent(item.geometry);
  const center=extent?
    [(extent[0]+extent[2])/2,(extent[1]+extent[3])/2] as [number,number]:null;
  return{
    name:p.name?.trim()||"Vegetation-change area",
    location:p.lgaNames?.length? p.lgaNames.join(", ")+(p.lgaNames.length===1?" LGA":" LGAs")+(p.stateName?", "+p.stateName+" State":""):"LGA and state not identified",
    direction,
    label:direction==="gain"?"Vegetation gain":direction==="loss"?"Vegetation loss":
      direction==="stable"?"No measured area change":"Vegetation result",
    metric,percentage,extent,center,
    dates:p.baselineDate&&p.comparisonDate?
      p.baselineDate+" → "+p.comparisonDate:null
  };
}
