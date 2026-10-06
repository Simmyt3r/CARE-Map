"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";

export default function SpatialAnalysisMap({latitude,longitude,results}:{latitude:number|null;longitude:number|null;results:any[]}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);

  useEffect(()=>{
    if(!node.current||latitude==null||longitude==null)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:[longitude,latitude],
      zoom:12,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      const features=results.map(r=>({
        type:"Feature" as const,
        geometry:r.geometry,
        properties:{id:r.id,name:r.name,entityType:r.entity_type,distanceM:r.distance_m,status:r.status,riskLevel:r.risk_level}
      }));
      map.addSource("analysis-results",{type:"geojson",data:{type:"FeatureCollection",features} as any});
      map.addSource("analysis-origin",{type:"geojson",data:{type:"Feature",geometry:{type:"Point",coordinates:[longitude,latitude]},properties:{}} as any});

      map.addLayer({id:"analysis-polygons",type:"fill",source:"analysis-results",filter:["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],paint:{"fill-color":"#2f855a","fill-opacity":0.22,"fill-outline-color":"#1f6b3b"}});
      map.addLayer({id:"analysis-lines",type:"line",source:"analysis-results",filter:["in",["geometry-type"],["literal",["LineString","MultiLineString"]]],paint:{"line-color":"#2878a8","line-width":4}});
      map.addLayer({id:"analysis-points",type:"circle",source:"analysis-results",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":7,"circle-color":"#d97706","circle-stroke-color":"#fff","circle-stroke-width":2}});
      map.addLayer({id:"analysis-origin",type:"circle",source:"analysis-origin",paint:{"circle-radius":9,"circle-color":"#1f6b3b","circle-stroke-color":"#fff","circle-stroke-width":3}});

      const bounds=new maplibregl.LngLatBounds([longitude,latitude],[longitude,latitude]);
      const visit=(value:any)=>{
        if(Array.isArray(value)&&value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){bounds.extend([value[0],value[1]]);return;}
        if(Array.isArray(value))value.forEach(visit);
      };
      results.forEach(r=>visit(r.geometry?.coordinates));
      if(results.length)map.fitBounds(bounds,{padding:50,maxZoom:15});

      const popup=(e:maplibregl.MapLayerMouseEvent)=>{
        const f=e.features?.[0];if(!f)return;
        const p=f.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||p.entityType||"Nearby feature";
        const meta=document.createElement("div");meta.textContent=(p.entityType||"")+" · "+Number(p.distanceM||0).toLocaleString()+" m";
        div.append(title,meta);
        new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      };
      ["analysis-points","analysis-lines","analysis-polygons"].forEach(layer=>map.on("click",layer,popup));
    });

    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[latitude,longitude,results]);

  if(latitude==null||longitude==null)return <div className="analysis-map-placeholder">Enter coordinates or use device GPS to start spatial analysis.</div>;
  return <div ref={node} className="analysis-map"/>;
}
