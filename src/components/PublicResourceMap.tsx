"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";

type Geometry={type:string;coordinates:any};

function visitCoordinates(value:any,cb:(lng:number,lat:number)=>void){
  if(Array.isArray(value)&&value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){
    cb(value[0],value[1]);return;
  }
  if(Array.isArray(value))value.forEach(x=>visitCoordinates(x,cb));
}

export default function PublicResourceMap({geometry,name}:{geometry:Geometry;name:string}){
  const node=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!node.current)return;
    const bounds=new maplibregl.LngLatBounds();
    visitCoordinates(geometry.coordinates,(lng,lat)=>bounds.extend([lng,lat]));
    const center=bounds.isEmpty()?[8.7,7.35]:bounds.getCenter();
    const map=new maplibregl.Map({
      container:node.current,
      center,
      zoom:geometry.type==="Point"?14:10,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:"metric"}),"bottom-left");
    map.on("load",()=>{
      map.addSource("resource",{type:"geojson",data:{type:"Feature",properties:{name},geometry} as any});
      if(geometry.type==="Point"){
        map.addLayer({id:"resource-point",type:"circle",source:"resource",paint:{"circle-radius":9,"circle-color":"#1f6b3b","circle-stroke-width":3,"circle-stroke-color":"#fff"}});
      }else if(geometry.type==="LineString"||geometry.type==="MultiLineString"){
        map.addLayer({id:"resource-line",type:"line",source:"resource",paint:{"line-color":"#2878a8","line-width":5}});
        if(!bounds.isEmpty())map.fitBounds(bounds,{padding:40,maxZoom:14});
      }else{
        map.addLayer({id:"resource-fill",type:"fill",source:"resource",paint:{"fill-color":"#2f855a","fill-opacity":0.3,"fill-outline-color":"#1f6b3b"}});
        if(!bounds.isEmpty())map.fitBounds(bounds,{padding:40,maxZoom:14});
      }
    });
    return()=>map.remove();
  },[geometry,name]);
  return <div ref={node} className="resource-map" aria-label={"Map location for "+name}/>;
}
