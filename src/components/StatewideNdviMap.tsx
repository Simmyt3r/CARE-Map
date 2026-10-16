"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import {deploymentProfile} from "@/lib/deployment-profile";
import type {FeatureCollection,Feature,Geometry} from "geojson";

type Lga={code:string;name:string;complete:boolean;coveragePercent:number;changeHa:number|null;changePct:number|null};
function paintClass(x?:Lga){
  return !x?.complete?"incomplete":x.changeHa==null?"incomplete":
    x.changeHa>0?"gain":x.changeHa<0?"loss":"stable";
}
export default function StatewideNdviMap({lgas}:{lgas:Lga[]}){
 const host=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<maplibregl.Map|null>(null);
 const[boundaries,setBoundaries]=useState<FeatureCollection|null>(null);
 const[issue,setIssue]=useState("");
 const data=useMemo(()=>{
  if(!boundaries)return null;
  const lookup=new Map(lgas.map(l=>[l.code,l]));
  return {type:"FeatureCollection",features:boundaries.features.map(f=>{
    const code=String(f.properties?.code||"");
    const stat=lookup.get(code);
    return {type:"Feature",geometry:f.geometry,
      properties:{code,name:f.properties?.name||stat?.name||code,
        category:paintClass(stat),
        coverage:stat?.coveragePercent??0,
        changeHa:stat?.complete?stat.changeHa:null,
        changePct:stat?.complete?stat.changePct:null}} as Feature;
  })} as FeatureCollection;
 },[boundaries,lgas]);
 useEffect(()=>{
  let active=true;
  fetch("/api/gis/lga-boundaries").then(async res=>{
    if(!res.ok)throw Error("Administrative boundaries unavailable.");
    return res.json();
  }).then(json=>{
    if(active&&json.type==="FeatureCollection"&&Array.isArray(json.features))
      setBoundaries(json as FeatureCollection);
  }).catch(()=>{if(active)setIssue("Could not load the LGA boundary map.");});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!host.current||mapRef.current)return;
  const map=new maplibregl.Map({
   container:host.current,center:deploymentProfile.mapCenter,zoom:deploymentProfile.mapZoom,
   style:{version:8,sources:{basemap:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},
    layers:[{id:"basemap",type:"raster",source:"basemap"}]}
  });
  mapRef.current=map;
  map.addControl(new maplibregl.NavigationControl(),"top-right");
  map.on("load",()=>{
    map.addSource("statewide-results",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
    map.addLayer({id:"statewide-ndvi-fill",type:"fill",source:"statewide-results",
      paint:{"fill-color":["match",["get","category"],
        "gain","#13814c","loss","#d95634","stable","#567a90","#979da3"],
        "fill-opacity":0.55}});
    map.addLayer({id:"statewide-ndvi-line",type:"line",source:"statewide-results",
      paint:{"line-color":"#fff","line-width":1.8}});
    map.on("click","statewide-ndvi-fill",e=>{
      const f=e.features?.[0];if(!f)return;
      const p=f.properties||{};
      const el=document.createElement("div");
      const title=document.createElement("strong");
      title.textContent=String(p.name||"LGA");
      const detail=document.createElement("p");
      const complete=p.category!=="incomplete";
      detail.textContent=complete
        ?String(p.category==="gain"?"Vegetation gain: ":p.category==="loss"?"Vegetation loss: ":"Vegetation change: ")+
          Number(p.changeHa).toFixed(1)+" ha · "+Number(p.changePct).toFixed(1)+"%"
        :"Analysis incomplete. Quality-covered area: "+Number(p.coverage||0).toFixed(1)+"%.";
      el.append(title,detail);
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(el).addTo(map);
    });
    map.on("mouseenter","statewide-ndvi-fill",()=>{map.getCanvas().style.cursor="pointer";});
    map.on("mouseleave","statewide-ndvi-fill",()=>{map.getCanvas().style.cursor="";});
  });
  return()=>{map.remove();mapRef.current=null;};
 },[]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!map||!data)return;
  const apply=()=>{
    (map.getSource("statewide-results") as maplibregl.GeoJSONSource|undefined)?.setData(data);
  };
  if(map.isStyleLoaded())apply();
  else map.once("load",apply);
 },[data]);
 return <section className="stack" aria-label="State-wide LGA vegetation change map">
   <h3>Geographic distribution by LGA</h3>
   <p className="muted">Each coloured LGA is an administrative summary of independently processed tiles. Grey means its result is incomplete, not zero vegetation change.</p>
   <div className="map-vegetation-legend" aria-label="State-wide NDVI legend">
     <span><i className="vegetation-gain"/> Vegetation gain</span>
     <span><i className="vegetation-loss"/> Vegetation loss</span>
     <span><i className="vegetation-stable"/> No measured area change</span>
     <span><i style={{background:"#979da3"}}/> Incomplete coverage</span>
   </div>
   {issue&&<div className="error" role="alert">{issue}</div>}
   <div ref={host} className="statewide-ndvi-map" role="region" aria-label="Interactive LGA vegetation comparison map"/>
 </section>;
}
