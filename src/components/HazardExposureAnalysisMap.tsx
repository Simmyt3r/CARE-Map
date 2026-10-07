"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

export default function HazardExposureAnalysisMap({result}:{result:any|null}){
  const node=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!node.current||!result?.boundary)return;
    const map=new maplibregl.Map({
      container:node.current,center:[8.7,7.35],zoom:7,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      const boundary={type:"Feature",geometry:result.boundary,properties:{role:"boundary"}};
      map.addSource("hazard-exposure-boundary",{type:"geojson",data:boundary as any});
      map.addSource("hazard-exposure-zones",{type:"geojson",data:result.zones as any});
      map.addSource("hazard-exposure-points",{type:"geojson",data:result.features as any});

      map.addLayer({
        id:"hazard-zone-fill",type:"fill",source:"hazard-exposure-zones",
        paint:{
          "fill-color":["match",["get","severity"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","low","#4b8b59","#777777"],
          "fill-opacity":0.30
        }
      });
      map.addLayer({
        id:"hazard-zone-outline",type:"line",source:"hazard-exposure-zones",
        paint:{"line-color":["match",["get","severity"],"critical","#8c1010","high","#a94d00","medium","#8b6a00","low","#2f6d3d","#555555"],"line-width":2}
      });
      map.addLayer({
        id:"hazard-lga-boundary",type:"line",source:"hazard-exposure-boundary",
        paint:{"line-color":"#173c27","line-width":2.5}
      });
      map.addLayer({
        id:"hazard-exposed-points",type:"circle",source:"hazard-exposure-points",
        paint:{
          "circle-radius":7,
          "circle-color":["match",["get","entityType"],"settlement","#7b5b00","borehole","#1f6b3b","asset","#6b4aa5","report","#a61b1b","#4b5b52"],
          "circle-stroke-color":"#ffffff","circle-stroke-width":1.8
        }
      });

      map.on("click","hazard-zone-fill",e=>{
        const f=e.features?.[0];if(!f)return;const p=f.properties||{};
        const div=document.createElement("div");div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||"Hazard zone";
        const meta=document.createElement("div");meta.textContent=[p.hazardType?.replaceAll("_"," "),p.severity,p.source].filter(Boolean).join(" • ");
        div.append(title,meta);new maplibregl.Popup({maxWidth:"360px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      map.on("click","hazard-exposed-points",e=>{
        const f=e.features?.[0];if(!f)return;const p=f.properties||{};
        const div=document.createElement("div");div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||p.entityType||"Exposed feature";
        const meta=document.createElement("div");meta.textContent=[p.entityType?.replaceAll("_"," "),p.status,p.population?Number(p.population).toLocaleString()+" people (sourced record)":null].filter(Boolean).join(" • ");
        div.append(title,meta);new maplibregl.Popup({maxWidth:"340px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      const extent=geometryExtent(result.boundary);
      if(extent)map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
    });

    return()=>map.remove();
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Run a verified hazard exposure scenario to map hazard polygons and intersecting mapped features.</div>;

  return <div className="stack">
    <div ref={node} className="hazard-exposure-map" aria-label="Verified hazard zone exposure map"/>
    <div className="coverage-legend">
      <span><i className="hazard-critical-key"/>Critical/high hazard</span>
      <span><i className="hazard-medium-key"/>Medium</span>
      <span><i className="hazard-low-key"/>Low</span>
      <span><i className="river-settlement-key"/>Settlement</span>
      <span><i className="river-borehole-key"/>Borehole</span>
      <span><i className="river-asset-key"/>Asset</span>
      <span><i className="river-report-key"/>Open report</span>
    </div>
  </div>;
}
