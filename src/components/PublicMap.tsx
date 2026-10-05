"use client";
import {useEffect,useRef,useState} from "react";
import maplibregl,{type GeoJSONSource} from "maplibre-gl";
type Lga={code:string;name:string};
type Filters={type:string;lga:string;status:string};
export default function PublicMap(){
 const node=useRef<HTMLDivElement|null>(null),mapRef=useRef<maplibregl.Map|null>(null),filterRef=useRef<Filters>({type:"",lga:"",status:""});
 const[type,setType]=useState(""),[lga,setLga]=useState(""),[status,setStatus]=useState(""),[lgas,setLgas]=useState<Lga[]>([]),[error,setError]=useState("");
 filterRef.current={type,lga,status};
 useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});},[]);
 async function loadFeatures(map=mapRef.current){
  if(!map)return;const b=map.getBounds(),f=filterRef.current;const qs=new URLSearchParams({bbox:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(",")});
  if(f.type)qs.set("type",f.type);if(f.lga)qs.set("lga",f.lga);if(f.status)qs.set("status",f.status);
  try{const r=await fetch("/api/map/features?"+qs);if(!r.ok)throw new Error();const data=await r.json();(map.getSource("caremap") as GeoJSONSource|undefined)?.setData(data);setError("");}catch{setError("Map data could not be loaded.");}
 }
 useEffect(()=>{
  if(!node.current||mapRef.current)return;
  const map=new maplibregl.Map({container:node.current,center:[8.7,7.35],zoom:6.5,style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}});
  map.addControl(new maplibregl.NavigationControl(),"top-right");
  map.on("load",()=>{
   map.addSource("caremap",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
   map.addLayer({id:"care-polygons",type:"fill",source:"caremap",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#2f855a","fill-opacity":0.28,"fill-outline-color":"#1f6b3b"}});
   map.addLayer({id:"care-lines",type:"line",source:"caremap",filter:["==",["geometry-type"],"LineString"],paint:{"line-color":"#2878a8","line-width":4}});
   map.addLayer({id:"care-points",type:"circle",source:"caremap",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":7,"circle-color":["match",["get","riskLevel"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#1f6b3b"],"circle-stroke-width":1.5,"circle-stroke-color":"#ffffff"}});
   const popup=(e:maplibregl.MapLayerMouseEvent)=>{const f=e.features?.[0];if(!f)return;const p=f.properties||{};const div=document.createElement("div");const title=document.createElement("strong");title.textContent=p.name||p.entityType||"CARE-Map item";const info=document.createElement("div");info.textContent=[p.entityType,p.lga,p.status,p.riskLevel&&("Risk: "+p.riskLevel)].filter(Boolean).join(" • ");div.append(title,info);new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(div).addTo(map);};
   map.on("click","care-points",popup);map.on("click","care-lines",popup);map.on("click","care-polygons",popup);loadFeatures(map);
  });
  map.on("moveend",()=>loadFeatures(map));mapRef.current=map;return()=>{map.remove();mapRef.current=null;};
 },[]);
 useEffect(()=>{loadFeatures();},[type,lga,status]);
 return <div className="card"><div className="filters"><div className="field"><label>Layer</label><select value={type} onChange={e=>setType(e.target.value)}><option value="">All interventions</option><option value="borehole">Boreholes</option><option value="asset">Assets</option><option value="forest_site">Forests</option><option value="river">Rivers</option></select></div><div className="field"><label>LGA</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">All LGAs</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div><div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Any status</option><option value="functional">Functional</option><option value="needs_maintenance">Needs maintenance</option><option value="non_functional">Non-functional</option></select></div><div className="field"><label>Legend</label><div className="notice">Markers are coloured by current risk level.</div></div></div>{error&&<div className="error">{error}</div>}<div ref={node} className="map-wrap" aria-label="CARE-Map interactive intervention map"/></div>;
}
