"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

export default function RiverCorridorAnalysisMap({result}:{result:any|null}){
  const node=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!node.current||!result?.boundary)return;

    const map=new maplibregl.Map({
      container:node.current,
      center:[8.7,7.35],
      zoom:7,
      style:{
        version:8,
        sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},
        layers:[{id:"osm",type:"raster",source:"osm"}]
      }
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      const boundary={type:"Feature",geometry:result.boundary,properties:{role:"boundary"}};
      const corridor=result.corridor?{type:"Feature",geometry:result.corridor,properties:{role:"corridor"}}:{type:"FeatureCollection",features:[]};

      map.addSource("river-exposure-boundary",{type:"geojson",data:boundary as any});
      map.addSource("river-exposure-corridor",{type:"geojson",data:corridor as any});
      map.addSource("river-exposure-rivers",{type:"geojson",data:result.rivers as any});
      map.addSource("river-exposure-features",{type:"geojson",data:result.features as any});

      map.addLayer({
        id:"river-exposure-corridor-fill",
        type:"fill",source:"river-exposure-corridor",
        paint:{"fill-color":"#2878a8","fill-opacity":0.18}
      });
      map.addLayer({
        id:"river-exposure-river-lines",
        type:"line",source:"river-exposure-rivers",
        paint:{"line-color":"#17639a","line-width":["interpolate",["linear"],["zoom"],6,2.5,13,5]}
      });
      map.addLayer({
        id:"river-exposure-boundary-line",
        type:"line",source:"river-exposure-boundary",
        paint:{"line-color":"#173c27","line-width":2.5,"line-opacity":0.8}
      });
      map.addLayer({
        id:"river-exposure-points",
        type:"circle",source:"river-exposure-features",
        paint:{
          "circle-radius":7,
          "circle-color":[
            "match",["get","entityType"],
            "settlement","#7b5b00",
            "borehole","#1f6b3b",
            "asset","#6b4aa5",
            "report","#a61b1b",
            "#4b5b52"
          ],
          "circle-stroke-color":"#ffffff",
          "circle-stroke-width":1.8
        }
      });

      map.on("click","river-exposure-points",e=>{
        const f=e.features?.[0];if(!f)return;
        const p=f.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");
        title.textContent=p.name||p.entityType||"Exposed feature";
        const meta=document.createElement("div");
        const distance=Number(p.distanceM);
        meta.textContent=[
          p.entityType?.replaceAll("_"," "),
          p.status,
          Number.isFinite(distance)?(distance<1000?distance.toFixed(0)+" m":(distance/1000).toFixed(2)+" km")+" from river":null,
          p.population?Number(p.population).toLocaleString()+" people (sourced record)":null
        ].filter(Boolean).join(" • ");
        div.append(title,meta);
        new maplibregl.Popup({maxWidth:"340px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      const extent=geometryExtent(result.boundary);
      if(extent)map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
    });

    return()=>map.remove();
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Run a river corridor scenario to map verified river geometry and nearby mapped features.</div>;

  return <div className="stack">
    <div ref={node} className="river-corridor-map" aria-label="River corridor exposure analysis map"/>
    <div className="coverage-legend">
      <span><i className="river-corridor-key"/>River corridor</span>
      <span><i className="river-line-key"/>Verified river</span>
      <span><i className="river-settlement-key"/>Settlement</span>
      <span><i className="river-borehole-key"/>Borehole</span>
      <span><i className="river-asset-key"/>Asset</span>
      <span><i className="river-report-key"/>Open report</span>
    </div>
  </div>;
}
