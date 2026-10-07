"use client";
import {useEffect,useRef} from "react";
import * as maplibregl from "maplibre-gl";

type Point=[number,number];
type Polygon={type:"Polygon";coordinates:Point[][]};

function pointsFromGeometry(value:any):Point[]{
  let ring:Point[]|null=null;
  if(value?.type==="Polygon"&&Array.isArray(value.coordinates?.[0]))ring=value.coordinates[0] as Point[];
  if(value?.type==="MultiPolygon"&&Array.isArray(value.coordinates?.[0]?.[0]))ring=value.coordinates[0][0] as Point[];
  if(!ring)return [];
  return ring.length>1&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]?ring.slice(0,-1):ring;
}

function featureCollection(points:Point[]){
  const features:any[]=[];
  if(points.length){
    features.push(...points.map((coordinates,i)=>({type:"Feature",properties:{index:i+1},geometry:{type:"Point",coordinates}})));
    if(points.length>=2)features.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:points}});
    if(points.length>=3)features.push({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...points,points[0]]]}});
  }
  return {type:"FeatureCollection",features} as any;
}

function polygonFromPoints(points:Point[]):Polygon|null{
  return points.length>=3?{type:"Polygon",coordinates:[[...points,points[0]]]}:null;
}

export default function AoiSketchMap({geometry,onChange}:{geometry:any;onChange:(geometry:Polygon|null)=>void}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const geometryRef=useRef(geometry);
  const onChangeRef=useRef(onChange);
  const points=pointsFromGeometry(geometry);

  useEffect(()=>{geometryRef.current=geometry;},[geometry]);
  useEffect(()=>{onChangeRef.current=onChange;},[onChange]);

  function apply(next:Point[]){
    const source=mapRef.current?.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
    source?.setData(featureCollection(next));
    onChangeRef.current(polygonFromPoints(next));
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
      const initial=pointsFromGeometry(geometryRef.current);
      map.addSource("aoi-sketch",{type:"geojson",data:featureCollection(initial)});
      map.addLayer({id:"aoi-fill",type:"fill",source:"aoi-sketch",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#2f855a","fill-opacity":0.22}});
      map.addLayer({id:"aoi-line",type:"line",source:"aoi-sketch",filter:["in",["geometry-type"],["literal",["LineString","Polygon"]]],paint:{"line-color":"#1f6b3b","line-width":3}});
      map.addLayer({id:"aoi-points",type:"circle",source:"aoi-sketch",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":6,"circle-color":"#d97706","circle-stroke-color":"#fff","circle-stroke-width":2}});
      if(initial.length>=3){
        const bounds=new maplibregl.LngLatBounds(initial[0],initial[0]);
        initial.forEach(p=>bounds.extend(p));
        map.fitBounds(bounds,{padding:40,maxZoom:15});
      }
    });
    map.on("click",e=>{
      const current=pointsFromGeometry(geometryRef.current);
      const point:Point=[Number(e.lngLat.lng.toFixed(6)),Number(e.lngLat.lat.toFixed(6))];
      const next=[...current,point];
      const source=map.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
      source?.setData(featureCollection(next));
      onChangeRef.current(polygonFromPoints(next));
    });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map?.isStyleLoaded())return;
    const incoming=pointsFromGeometry(geometry);
    const source=map.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
    source?.setData(featureCollection(incoming));
    if(incoming.length>=3){
      const bounds=new maplibregl.LngLatBounds(incoming[0],incoming[0]);
      incoming.forEach(p=>bounds.extend(p));
      map.fitBounds(bounds,{padding:40,maxZoom:15});
    }
  },[geometry]);

  return <div className="stack">
    <div className="aoi-sketch-map" ref={node}/>
    <div className="section-head">
      <div className="muted">Click the map to add vertices. Three or more points create a closed polygon.</div>
      <div className="actions">
        <span className="badge">{points.length} vertices</span>
        <button type="button" className="btn" disabled={!points.length} onClick={()=>apply(points.slice(0,-1))}>Undo</button>
        <button type="button" className="btn danger" disabled={!points.length} onClick={()=>apply([])}>Clear</button>
      </div>
    </div>
  </div>;
}
