"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";

export default function CoverageAnalysisMap({result}:{result:any|null}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);

  useEffect(()=>{
    if(!node.current||!result?.boundary)return;

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
      const boundaryFeature={type:"Feature",geometry:result.boundary,properties:{role:"boundary"}};
      const coveredData=result.covered
        ?{type:"Feature",geometry:result.covered,properties:{role:"covered"}}
        :{type:"FeatureCollection",features:[]};
      const uncoveredData=result.uncovered
        ?{type:"Feature",geometry:result.uncovered,properties:{role:"uncovered"}}
        :{type:"FeatureCollection",features:[]};

      map.addSource("coverage-boundary",{type:"geojson",data:boundaryFeature as any});
      map.addSource("coverage-covered",{type:"geojson",data:coveredData as any});
      map.addSource("coverage-uncovered",{type:"geojson",data:uncoveredData as any});
      map.addSource("coverage-resources",{type:"geojson",data:result.resources as any});
      map.addSource("coverage-gaps",{type:"geojson",data:result.gaps as any});

      map.addLayer({
        id:"coverage-uncovered-fill",
        type:"fill",
        source:"coverage-uncovered",
        paint:{"fill-color":"#a61b1b","fill-opacity":0.18}
      });
      map.addLayer({
        id:"coverage-covered-fill",
        type:"fill",
        source:"coverage-covered",
        paint:{"fill-color":"#2f855a","fill-opacity":0.30}
      });
      map.addLayer({
        id:"coverage-gap-outlines",
        type:"line",
        source:"coverage-gaps",
        paint:{"line-color":"#8f1f1f","line-width":1.5,"line-dasharray":[3,2]}
      });
      map.addLayer({
        id:"coverage-gap-labels",
        type:"symbol",
        source:"coverage-gaps",
        layout:{
          "text-field":["concat","#",["to-string",["get","rank"]]],
          "text-size":12,
          "text-allow-overlap":false
        },
        paint:{"text-color":"#8f1f1f","text-halo-color":"#ffffff","text-halo-width":1.5}
      });
      map.addLayer({
        id:"coverage-boundary-line",
        type:"line",
        source:"coverage-boundary",
        paint:{"line-color":"#173c27","line-width":3}
      });
      map.addLayer({
        id:"coverage-resources-points",
        type:"circle",
        source:"coverage-resources",
        paint:{
          "circle-radius":7,
          "circle-color":[
            "case",
            ["boolean",["get","insideLga"],false],
            "#1f6b3b",
            "#2878a8"
          ],
          "circle-stroke-color":"#ffffff",
          "circle-stroke-width":2
        }
      });

      map.on("click","coverage-resources-points",e=>{
        const feature=e.features?.[0];
        if(!feature)return;
        const p=feature.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");
        title.textContent=p.name||"Mapped resource";
        const meta=document.createElement("div");
        meta.textContent=[
          p.assetType,
          p.status,
          p.insideLga?"Inside selected LGA":"Outside LGA, contributes cross-boundary coverage"
        ].filter(Boolean).join(" • ");
        div.append(title,meta);
        new maplibregl.Popup({maxWidth:"320px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });

      const extent=geometryExtent(result.boundary);
      if(extent){
        map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
      }
    });

    mapRef.current=map;
    return()=>{
      map.remove();
      mapRef.current=null;
    };
  },[result]);

  if(!result)return <div className="analysis-map-placeholder">Choose an LGA and run a coverage scenario to map covered and uncovered territory.</div>;

  return <div className="stack">
    <div ref={node} className="coverage-map" aria-label="Intervention territorial coverage map"/>
    <div className="coverage-legend">
      <span><i className="coverage-covered-key"/>Covered area</span>
      <span><i className="coverage-uncovered-key"/>Uncovered area</span>
      <span><i className="coverage-inside-key"/>Resource inside LGA</span>
      <span><i className="coverage-external-key"/>External supporting resource</span>
    </div>
  </div>;
}
