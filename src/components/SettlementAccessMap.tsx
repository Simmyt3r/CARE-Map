"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

export default function SettlementAccessMap({result}:{result:any|null}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);

  useEffect(()=>{
    if(!node.current||!result)return;

    const map=new maplibregl.Map({
      container:node.current,
      center:[8.7,7.35],
      zoom:7,
      style:{
        version:8,
        sources:{
          osm:{
            type:"raster",
            tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize:256,
            attribution:"© OpenStreetMap contributors"
          }
        },
        layers:[{id:"osm",type:"raster",source:"osm"}]
      }
    });

    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      const boundaryData=result.lga.boundary
        ?{type:"Feature",geometry:result.lga.boundary,properties:{role:"lga"}}
        :{type:"FeatureCollection",features:[]};

      map.addSource("settlement-access-boundary",{type:"geojson",data:boundaryData as any});
      map.addSource("settlement-access-lines",{type:"geojson",data:result.gapLines as any});
      map.addSource("settlement-access-boreholes",{type:"geojson",data:result.nearestBoreholes as any});
      map.addSource("settlement-access-settlements",{type:"geojson",data:result.settlements as any});
      map.addSource("settlement-access-gaps",{type:"geojson",data:result.gaps as any});

      map.addLayer({
        id:"settlement-access-boundary-fill",
        type:"fill",
        source:"settlement-access-boundary",
        paint:{"fill-color":"#244d35","fill-opacity":0.04}
      });
      map.addLayer({
        id:"settlement-access-boundary-line",
        type:"line",
        source:"settlement-access-boundary",
        paint:{"line-color":"#173c27","line-width":2.5}
      });
      map.addLayer({
        id:"settlement-access-gap-lines",
        type:"line",
        source:"settlement-access-lines",
        paint:{"line-color":"#9a6600","line-width":1.5,"line-dasharray":[3,2],"line-opacity":0.65}
      });
      map.addLayer({
        id:"settlement-access-boreholes",
        type:"circle",
        source:"settlement-access-boreholes",
        paint:{
          "circle-radius":8,
          "circle-color":"#2878a8",
          "circle-stroke-color":"#ffffff",
          "circle-stroke-width":2
        }
      });
      map.addLayer({
        id:"settlement-access-settlements",
        type:"circle",
        source:"settlement-access-settlements",
        paint:{
          "circle-radius":7,
          "circle-color":[
            "match",["get","accessClass"],
            "within_threshold","#1f6b3b",
            "access_gap","#db6d00",
            "beyond_search_radius","#a61b1b",
            "#647067"
          ],
          "circle-opacity":["case",["boolean",["get","verified"],false],1,0.55],
          "circle-stroke-color":"#ffffff",
          "circle-stroke-width":2
        }
      });
      map.addLayer({
        id:"settlement-access-gap-labels",
        type:"symbol",
        source:"settlement-access-gaps",
        layout:{
          "text-field":["concat","#",["to-string",["get","rank"]]],
          "text-size":11,
          "text-offset":[0,1.3],
          "text-anchor":"top",
          "text-allow-overlap":false
        },
        paint:{"text-color":"#8f1f1f","text-halo-color":"#ffffff","text-halo-width":1.4}
      });

      map.on("click","settlement-access-settlements",e=>{
        const feature=e.features?.[0];
        if(!feature)return;
        const p=feature.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");
        title.textContent=p.name||"Settlement";
        const meta=document.createElement("div");
        const distance=p.nearestDistanceM==null
          ?"No functional borehole found inside search horizon"
          :Math.round(Number(p.nearestDistanceM)).toLocaleString()+" m to "+(p.nearestBoreholeName||"nearest functional borehole");
        meta.textContent=distance;
        div.append(title,meta);
        if(p.population!=null){
          const pop=document.createElement("small");
          pop.textContent="Population: "+Number(p.population).toLocaleString()+(p.populationYear?" ("+p.populationYear+")":"");
          div.append(pop);
        }
        new maplibregl.Popup({maxWidth:"340px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      map.on("click","settlement-access-boreholes",e=>{
        const feature=e.features?.[0];
        if(!feature)return;
        const p=feature.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");
        title.textContent=p.name||"Functional borehole";
        const meta=document.createElement("div");
        meta.textContent="Functional borehole used in settlement access analysis";
        div.append(title,meta);
        new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      const boundaryExtent=geometryExtent(result.lga.boundary);
      if(boundaryExtent){
        map.fitBounds([[boundaryExtent[0],boundaryExtent[1]],[boundaryExtent[2],boundaryExtent[3]]],{padding:42,maxZoom:12});
      }else{
        const features=result.settlements?.features||[];
        if(features.length){
          const first=features[0].geometry.coordinates as [number,number];
          const bounds=new maplibregl.LngLatBounds(first,first);
          for(const feature of features){
            const coordinates=feature.geometry.coordinates as [number,number];
            bounds.extend(coordinates);
          }
          map.fitBounds(bounds,{padding:42,maxZoom:13});
        }
      }
    });

    mapRef.current=map;
    return()=>{
      map.remove();
      mapRef.current=null;
    };
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Run settlement access analysis to map communities and functional boreholes.</div>;

  return <div className="stack">
    <div ref={node} className="settlement-access-map" aria-label="Settlement access to functional boreholes map"/>
    <div className="coverage-legend">
      <span><i className="settlement-served-key"/>Within threshold</span>
      <span><i className="settlement-gap-key"/>Access gap</span>
      <span><i className="settlement-unknown-key"/>No borehole inside search horizon</span>
      <span><i className="settlement-borehole-key"/>Functional borehole</span>
    </div>
  </div>;
}
