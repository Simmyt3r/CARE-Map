"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import {coordinateVertex,polygonFromVertices,verticesFromAoi,
  type AoiGeometry,type AoiPoint,type AoiPolygon} from "@/lib/aoi-editor";

function featureCollection(points:AoiPoint[]){
  const features:GeoJSON.Feature[]=[];
  points.forEach((coordinates,i)=>features.push({
    type:"Feature",properties:{index:i+1},
    geometry:{type:"Point",coordinates}
  }));
  if(points.length>=2)features.push({
    type:"Feature",properties:{},
    geometry:{type:"LineString",coordinates:points}
  });
  const polygon=polygonFromVertices(points);
  if(polygon)features.push({type:"Feature",properties:{},geometry:polygon});
  return {type:"FeatureCollection",features} as GeoJSON.FeatureCollection;
}

export default function AoiSketchMap({geometry,onChange}:{
  geometry:AoiGeometry|null;
  onChange:(geometry:AoiPolygon|null)=>void;
}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const verticesRef=useRef<AoiPoint[]>([]);
  const[vertices,setVertices]=useState<AoiPoint[]>(()=>verticesFromAoi(geometry));
  const onChangeRef=useRef(onChange);
  const emittedGeometryRef=useRef<string|null>(null);
  const[latitude,setLatitude]=useState("");
  const[longitude,setLongitude]=useState("");
  const[feedback,setFeedback]=useState("");
  const[mapReady,setMapReady]=useState(false);

  useEffect(()=>{onChangeRef.current=onChange;},[onChange]);

  const update=useCallback((next:AoiPoint[],emit=true)=>{
    verticesRef.current=next;
    setVertices(next);
    const map=mapRef.current;
    const source=map?.getSource("aoi-sketch") as maplibregl.GeoJSONSource|undefined;
    source?.setData(featureCollection(next));
    if(emit){
      const polygon=polygonFromVertices(next);
      emittedGeometryRef.current=polygon?JSON.stringify(polygon):"null";
      onChangeRef.current(polygon);
    }
  },[]);

  useEffect(()=>{
    if(!node.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:[8.75,7.35],
      zoom:7,
      interactive:true,
      style:{
        version:8,
        sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},
        layers:[{id:"osm",type:"raster",source:"osm"}]
      }
    });
    mapRef.current=map;
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.on("load",()=>{
      map.addSource("aoi-sketch",{type:"geojson",data:featureCollection(verticesRef.current)});
      map.addLayer({id:"aoi-fill",type:"fill",source:"aoi-sketch",
        filter:["==",["geometry-type"],"Polygon"],
        paint:{"fill-color":"#2f855a","fill-opacity":0.25}});
      map.addLayer({id:"aoi-line",type:"line",source:"aoi-sketch",
        filter:["in",["geometry-type"],["literal",["LineString","Polygon"]]],
        paint:{"line-color":"#1f6b3b","line-width":3}});
      map.addLayer({id:"aoi-points",type:"circle",source:"aoi-sketch",
        filter:["==",["geometry-type"],"Point"],
        paint:{"circle-radius":7,"circle-color":"#d97706",
          "circle-stroke-color":"#fff","circle-stroke-width":2}});
      setMapReady(true);
      if(verticesRef.current.length>=3){
        const points=verticesRef.current;
        const bounds=new maplibregl.LngLatBounds(points[0],points[0]);
        points.forEach(p=>bounds.extend(p));
        map.fitBounds(bounds,{padding:40,maxZoom:15});
      }
    });
    map.on("click",e=>{
      const point:AoiPoint=[Number(e.lngLat.lng.toFixed(6)),Number(e.lngLat.lat.toFixed(6))];
      update([...verticesRef.current,point]);
      setFeedback("");
    });
    return ()=>{
      map.remove();
      mapRef.current=null;
    };
  },[update]);

  // Sync ONLY externally changed AOIs (selected forest / pasted GeoJSON).
  // Locally drawn 1- and 2-vertex drafts must not be discarded just because
  // the parent still has no *complete* polygon.
  useEffect(()=>{
    const key=geometry?JSON.stringify(geometry):"null";
    if(key===emittedGeometryRef.current)return;
    const incoming=verticesFromAoi(geometry);
    update(incoming,false);
    const map=mapRef.current;
    if(map?.isStyleLoaded()&&incoming.length>=3){
      const bounds=new maplibregl.LngLatBounds(incoming[0],incoming[0]);
      incoming.forEach(point=>bounds.extend(point));
      map.fitBounds(bounds,{padding:40,maxZoom:15});
    }
  },[geometry,update]);

  function addCoordinate(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      const vertex=coordinateVertex(latitude,longitude);
      update([...verticesRef.current,vertex]);
      setFeedback("Corner "+(verticesRef.current.length)+" added. "+
        (verticesRef.current.length<3?"Add "+(3-verticesRef.current.length)+" more corner(s).":"Area of interest is ready."));
      setLatitude("");setLongitude("");
    }catch(e){
      setFeedback(e instanceof Error?e.message:"Enter valid WGS84 coordinates.");
    }
  }
  function undo(){
    update(verticesRef.current.slice(0,-1));
    setFeedback("Last corner removed.");
  }
  function clear(){
    update([]);
    setFeedback("AOI cleared. Add at least three corners.");
  }

  return <div className="stack">
    <div className="notice" role="status">
      <strong>{vertices.length>=3
        ?"AOI ready: "+vertices.length+" corners"
        :vertices.length
          ?vertices.length+" of at least 3 corners captured"
          :"No area drawn yet"}</strong>
      <div className="geometry-help">
        Tap the map to place corners or enter latitude/longitude below.
        The first two corners are saved as a draft; the third closes the polygon automatically.
      </div>
    </div>
    <div className="aoi-sketch-map" ref={node} role="region"
      aria-label="Interactive Sentinel-2 area of interest map"/>
    {!mapReady&&<div className="geometry-help">Loading map… You can also enter corners below.</div>}
    <form onSubmit={addCoordinate} className="aoi-coordinate-entry">
      <div className="field">
        <label htmlFor="aoi-latitude">Latitude</label>
        <input id="aoi-latitude" type="number" step="any" min="-90" max="90" inputMode="decimal"
          value={latitude} onChange={e=>setLatitude(e.target.value)}
          placeholder="e.g. 7.735" required/>
      </div>
      <div className="field">
        <label htmlFor="aoi-longitude">Longitude</label>
        <input id="aoi-longitude" type="number" step="any" min="-180" max="180" inputMode="decimal"
          value={longitude} onChange={e=>setLongitude(e.target.value)}
          placeholder="e.g. 8.535" required/>
      </div>
      <button type="submit" className="btn">Add corner</button>
    </form>
    {feedback&&<div role="status" className="geometry-help">{feedback}</div>}
    <div className="section-head">
      <div className="muted">
        {vertices.length>=3
          ?"The green polygon is your analysis boundary. Add another corner to extend it, or undo."
          :"Use three or more non-collinear corners to create the AOI."}
      </div>
      <div className="actions">
        <span className="badge">{vertices.length} vertices</span>
        <button type="button" className="btn" disabled={!vertices.length} onClick={undo}>Undo</button>
        <button type="button" className="btn danger" disabled={!vertices.length} onClick={clear}>Clear</button>
      </div>
    </div>
  </div>;
}
