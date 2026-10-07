"use client";
import {useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";

type Point=[number,number];
type Polygon={type:"Polygon";coordinates:Point[][]};

function pointsFromGeometry(value:any):Point[]{
  if(value?.type==="Polygon"&&Array.isArray(value.coordinates?.[0])){
    const ring=value.coordinates[0] as Point[];
    return ring.length>1&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]?ring.slice(0,-1):ring;
  }
  return [];
}

export default function AoiSketchMap({geometry,onChange}:{geometry:any;onChange:(geometry:Polygon|null)=>void}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const sourceReady=useRef(false);
  const[points,setPoints]=useState<Point[]>(()=>pointsFromGeometry(geometry));

  function collection(next:Point[]){
    const features:any[]=[];
    if(next.length){
      features.push(...next.map((coordinates,i)=>({type:"Feature",properties:{index:i+1},geometry:{type:"Point",coordinates}})));
      if(next.length>=2)features.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:next}});
      if(next.length>=3)features.push({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...next,next[0]]]}});
    }
    return {type:"FeatureCollection",features} as any;
  }

  function sync(next:Point[]){
    setPoints(next);
    const source=mapRef.current?.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
    source?.setData(collection(next));
    onChange(next.length>=3?{type:"Polygon",coordinates:[[...next,next[0]]]}:null);
  }

  useEffect(()=>{
    if(!node.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:[8.75,7.35],
      zoom:7,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.on("load",()=>{
      map.addSource("aoi-sketch",{type:"geojson",data:collection(points)});
      map.addLayer({id:"aoi-fill",type:"fill",source:"aoi-sketch",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#2f855a","fill-opacity":0.22}});
      map.addLayer({id:"aoi-line",type:"line",source:"aoi-sketch",filter:["in",["geometry-type"],["literal",["LineString","Polygon"]]],paint:{"line-color":"#1f6b3b","line-width":3}});
      map.addLayer({id:"aoi-points",type:"circle",source:"aoi-sketch",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":6,"circle-color":"#d97706","circle-stroke-color":"#fff","circle-stroke-width":2}});
      sourceReady.current=true;
      if(points.length>=3){
        const bounds=new maplibregl.LngLatBounds(points[0],points[0]);points.forEach(p=>bounds.extend(p));map.fitBounds(bounds,{padding:40,maxZoom:15});
      }
    });
    map.on("click",e=>{
      const p:[number,number]=[Number(e.lngLat.lng.toFixed(6)),Number(e.lngLat.lat.toFixed(6))];
      setPoints(current=>{
        const next=[...current,p];
        const source=map.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
        source?.setData(collection(next));
        onChange(next.length>=3?{type:"Polygon",coordinates:[[...next,next[0]]]}:null);
        return next;
      });
    });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;sourceReady.current=false;};
  },[]);

  useEffect(()=>{
    const incoming=pointsFromGeometry(geometry);
    if(!sourceReady.current)return;
    if(JSON.stringify(incoming)!==JSON.stringify(points)){
      setPoints(incoming);
      const source=mapRef.current?.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
      source?.setData(collection(incoming));
      if(incoming.length>=3&&mapRef.current){
        const bounds=new maplibregl.LngLatBounds(incoming[0],incoming[0]);incoming.forEach(p=>bounds.extend(p));mapRef.current.fitBounds(bounds,{padding:40,maxZoom:15});
      }
    }
  },[geometry]);

  return <div className="stack">
    <div className="aoi-sketch-map" ref={node}/>
    <div className="section-head">
      <div className="muted">Click the map to add vertices. Three or more points create a closed polygon.</div>
      <div className="actions">
        <span className="badge">{points.length} vertices</span>
        <button type="button" className="btn" disabled={!points.length} onClick={()=>sync(points.slice(0,-1))}>Undo</button>
        <button type="button" className="btn danger" disabled={!points.length} onClick={()=>sync([])}>Clear</button>
      </div>
    </div>
  </div>;
}
