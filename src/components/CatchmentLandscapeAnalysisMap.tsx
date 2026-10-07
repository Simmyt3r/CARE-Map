"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

function mergeCollections(...collections:any[]){
  return {
    type:"FeatureCollection",
    features:collections.flatMap(c=>Array.isArray(c?.features)?c.features:[])
  };
}

export default function CatchmentLandscapeAnalysisMap({result}:{result:any|null}){
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
      const boundary={type:"Feature",geometry:result.boundary,properties:{role:"catchment"}};
      const points=mergeCollections(
        result.layers?.settlements,
        result.layers?.boreholes,
        result.layers?.assets,
        result.layers?.reports
      );

      map.addSource("catchment-boundary",{type:"geojson",data:boundary as any});
      map.addSource("catchment-forests",{type:"geojson",data:result.layers?.forests as any});
      map.addSource("catchment-hazards",{type:"geojson",data:result.layers?.hazards as any});
      map.addSource("catchment-vegetation",{type:"geojson",data:result.layers?.vegetation as any});
      map.addSource("catchment-rivers",{type:"geojson",data:result.layers?.rivers as any});
      map.addSource("catchment-points",{type:"geojson",data:points as any});

      map.addLayer({
        id:"catchment-forest-fill",type:"fill",source:"catchment-forests",
        paint:{"fill-color":"#4b8b59","fill-opacity":0.18}
      });
      map.addLayer({
        id:"catchment-vegetation-outline",type:"line",source:"catchment-vegetation",
        paint:{
          "line-color":["match",["get","changeLevel"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#6d4aa5"],
          "line-width":2,"line-dasharray":[3,2]
        }
      });
      map.addLayer({
        id:"catchment-hazard-fill",type:"fill",source:"catchment-hazards",
        paint:{
          "fill-color":["match",["get","severity"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","low","#8a7a43","#777777"],
          "fill-opacity":0.22
        }
      });
      map.addLayer({
        id:"catchment-river-lines",type:"line",source:"catchment-rivers",
        paint:{"line-color":"#17639a","line-width":["interpolate",["linear"],["zoom"],6,2,13,4]}
      });
      map.addLayer({
        id:"catchment-boundary-line",type:"line",source:"catchment-boundary",
        paint:{"line-color":"#173c27","line-width":3}
      });
      map.addLayer({
        id:"catchment-points-layer",type:"circle",source:"catchment-points",
        paint:{
          "circle-radius":6.5,
          "circle-color":[
            "match",["get","entityType"],
            "settlement","#7b5b00",
            "borehole","#1f6b3b",
            "asset","#6b4aa5",
            "report","#a61b1b",
            "#4b5b52"
          ],
          "circle-stroke-color":"#ffffff","circle-stroke-width":1.5
        }
      });

      map.on("click","catchment-points-layer",e=>{
        const f=e.features?.[0];if(!f)return;const p=f.properties||{};
        const div=document.createElement("div");div.className="map-popup";
        const title=document.createElement("strong");title.textContent=p.name||p.entityType||"Landscape feature";
        const meta=document.createElement("div");
        meta.textContent=[
          p.entityType?.replaceAll("_"," "),
          p.assetType,
          p.status,
          p.priority&&("Priority: "+p.priority),
          p.population?Number(p.population).toLocaleString()+" people (sourced record)":null
        ].filter(Boolean).join(" • ");
        div.append(title,meta);
        new maplibregl.Popup({maxWidth:"350px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      for(const layer of ["catchment-hazard-fill","catchment-forest-fill"]){
        map.on("click",layer,e=>{
          const f=e.features?.[0];if(!f)return;const p=f.properties||{};
          const div=document.createElement("div");div.className="map-popup";
          const title=document.createElement("strong");title.textContent=p.name||"Landscape polygon";
          const meta=document.createElement("div");
          meta.textContent=[p.entityType?.replaceAll("_"," "),p.hazardType?.replaceAll("_"," "),p.siteType?.replaceAll("_"," "),p.severity,p.status].filter(Boolean).join(" • ");
          div.append(title,meta);
          new maplibregl.Popup({maxWidth:"350px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
        });
      }

      const extent=geometryExtent(result.boundary);
      if(extent)map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
    });

    return()=>map.remove();
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Choose a verified catchment to build a cross-layer landscape summary.</div>;

  return <div className="stack">
    <div ref={node} className="catchment-landscape-map" aria-label="Catchment landscape planning map"/>
    <div className="coverage-legend">
      <span><i className="catchment-boundary-key"/>Catchment</span>
      <span><i className="catchment-forest-key"/>Forest</span>
      <span><i className="catchment-hazard-key"/>Verified hazard</span>
      <span><i className="river-line-key"/>Verified river</span>
      <span><i className="river-settlement-key"/>Settlement</span>
      <span><i className="river-borehole-key"/>Borehole</span>
      <span><i className="river-asset-key"/>Asset</span>
      <span><i className="river-report-key"/>Open report</span>
    </div>
  </div>;
}
