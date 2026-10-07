"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

function visitCoordinates(value:any,bounds:maplibregl.LngLatBounds){
  if(Array.isArray(value)&&value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){
    bounds.extend([value[0],value[1]]);return;
  }
  if(Array.isArray(value))value.forEach(v=>visitCoordinates(v,bounds));
}

export default function EnvironmentalExposureMap({result}:{result:any|null}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);

  useEffect(()=>{
    if(!node.current||!result||!result.zones?.features?.length)return;
    const first=result.zones.features[0];
    const firstExtent=geometryExtent(first.geometry);
    const start:[number,number]=firstExtent
      ?[(firstExtent[0]+firstExtent[2])/2,(firstExtent[1]+firstExtent[3])/2]
      :[8.7,7.35];
    const map=new maplibregl.Map({
      container:node.current,center:start,zoom:8,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      map.addSource("risk-zones",{type:"geojson",data:result.zones});
      map.addSource("risk-forests",{type:"geojson",data:result.forests});
      const pointFeatures=[
        ...(result.settlements?.features||[]),...(result.boreholes?.features||[]),
        ...(result.assets?.features||[]),...(result.reports?.features||[])
      ];
      map.addSource("risk-points",{type:"geojson",data:{type:"FeatureCollection",features:pointFeatures} as any});

      map.addLayer({id:"risk-zone-fill",type:"fill",source:"risk-zones",paint:{
        "fill-color":["match",["get","severity"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#4c956c"],
        "fill-opacity":0.28
      }});
      map.addLayer({id:"risk-zone-line",type:"line",source:"risk-zones",paint:{
        "line-color":["match",["get","severity"],"critical","#7a1010","high","#a94d00","medium","#9c7900","#2f6b49"],
        "line-width":2
      }});
      map.addLayer({id:"risk-forest-fill",type:"fill",source:"risk-forests",paint:{"fill-color":"#6d4c9c","fill-opacity":0.20,"fill-outline-color":"#54377d"}});
      map.addLayer({id:"risk-points-layer",type:"circle",source:"risk-points",paint:{
        "circle-radius":7,
        "circle-color":["match",["get","entityType"],"settlement","#7b2cbf","borehole","#2878a8","asset","#1f6b3b","report","#b42318","#647067"],
        "circle-stroke-color":"#ffffff","circle-stroke-width":2
      }});

      map.on("click","risk-zone-fill",e=>{
        const f=e.features?.[0];if(!f)return;const p=f.properties||{};
        const div=document.createElement("div");div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||"Risk zone";
        const meta=document.createElement("div");meta.textContent=[p.hazardType,p.severity,p.areaKm2&&p.areaKm2+" km²",p.source].filter(Boolean).join(" • ");
        div.append(title,meta);new maplibregl.Popup({maxWidth:"340px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });
      map.on("click","risk-points-layer",e=>{
        const f=e.features?.[0];if(!f)return;const p=f.properties||{};
        const div=document.createElement("div");div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||p.entityType||"Exposed feature";
        const meta=document.createElement("div");meta.textContent=[p.entityType,p.assetType,p.status,p.priority].filter(Boolean).join(" • ");
        div.append(title,meta);new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      const bounds=new maplibregl.LngLatBounds(start,start);
      for(const feature of result.zones.features)visitCoordinates(feature.geometry?.coordinates,bounds);
      map.fitBounds(bounds,{padding:45,maxZoom:12});
    });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Run environmental exposure analysis to map verified hazard zones and intersecting resources.</div>;
  if(!result.zones?.features?.length)return <div className="analysis-map-placeholder">No risk zones match the selected filters.</div>;
  return <div className="stack">
    <div ref={node} className="environmental-exposure-map" aria-label="Environmental risk exposure map"/>
    <div className="coverage-legend">
      <span><i className="risk-zone-key"/>Hazard zone</span>
      <span><i className="risk-settlement-key"/>Settlement</span>
      <span><i className="risk-borehole-key"/>Borehole</span>
      <span><i className="risk-asset-key"/>Asset</span>
      <span><i className="risk-report-key"/>Open report</span>
      <span><i className="risk-forest-key"/>Forest site</span>
    </div>
  </div>;
}
