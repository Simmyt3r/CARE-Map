"use client";
import {useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource} from "maplibre-gl";

type Lga={code:string;name:string};
type Filters={type:string;lga:string;status:string};

export default function PublicMap(){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const filterRef=useRef<Filters>({type:"",lga:"",status:""});
  const[type,setType]=useState(""),[lga,setLga]=useState(""),[status,setStatus]=useState("");
  const[lgas,setLgas]=useState<Lga[]>([]),[error,setError]=useState("");

  useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});},[]);

  async function loadFeatures(map=mapRef.current){
    if(!map)return;
    const b=map.getBounds(),f=filterRef.current;
    const qs=new URLSearchParams({bbox:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(",")});
    if(f.type)qs.set("type",f.type);
    if(f.lga)qs.set("lga",f.lga);
    if(f.status)qs.set("status",f.status);
    try{
      const r=await fetch("/api/map/features?"+qs);
      if(!r.ok)throw new Error();
      const data=await r.json();
      const points={type:"FeatureCollection",features:(data.features||[]).filter((x:any)=>x.geometry?.type==="Point")} as any;
      const shapes={type:"FeatureCollection",features:(data.features||[]).filter((x:any)=>x.geometry?.type!=="Point")} as any;
      (map.getSource("carepoints") as GeoJSONSource|undefined)?.setData(points);
      (map.getSource("careshapes") as GeoJSONSource|undefined)?.setData(shapes);
      setError("");
    }catch{setError("Map data could not be loaded.");}
  }

  useEffect(()=>{
    if(!node.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:[8.7,7.35],
      zoom:6.5,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      map.addSource("carepoints",{type:"geojson",data:{type:"FeatureCollection",features:[]},cluster:true,clusterRadius:46,clusterMaxZoom:13});
      map.addSource("careshapes",{type:"geojson",data:{type:"FeatureCollection",features:[]}});

      map.addLayer({id:"care-polygons",type:"fill",source:"careshapes",filter:["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],paint:{"fill-color":"#2f855a","fill-opacity":0.26,"fill-outline-color":"#1f6b3b"}});
      map.addLayer({id:"care-lines",type:"line",source:"careshapes",filter:["in",["geometry-type"],["literal",["LineString","MultiLineString"]]],paint:{"line-color":"#2878a8","line-width":["interpolate",["linear"],["zoom"],6,2,13,5]}});

      map.addLayer({id:"clusters",type:"circle",source:"carepoints",filter:["has","point_count"],paint:{
        "circle-color":["step",["get","point_count"],"#1f6b3b",20,"#d6a600",60,"#db6d00",150,"#a61b1b"],
        "circle-radius":["step",["get","point_count"],17,20,22,60,27,150,32],
        "circle-stroke-width":2,"circle-stroke-color":"#ffffff"
      }});
      map.addLayer({id:"cluster-count",type:"symbol",source:"carepoints",filter:["has","point_count"],layout:{"text-field":["get","point_count_abbreviated"],"text-size":12},paint:{"text-color":"#ffffff"}});
      map.addLayer({id:"care-points",type:"circle",source:"carepoints",filter:["!",["has","point_count"]],paint:{
        "circle-radius":7,
        "circle-color":["match",["get","riskLevel"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#1f6b3b"],
        "circle-stroke-width":1.5,"circle-stroke-color":"#ffffff"
      }});

      map.on("click","clusters",async e=>{
        const feature=map.queryRenderedFeatures(e.point,{layers:["clusters"]})[0];
        const clusterId=feature?.properties?.cluster_id;
        if(clusterId==null)return;
        const source=map.getSource("carepoints") as GeoJSONSource;
        const zoom=await source.getClusterExpansionZoom(clusterId);
        const coords=(feature.geometry as GeoJSON.Point).coordinates as [number,number];
        map.easeTo({center:coords,zoom});
      });

      const popup=(e:maplibregl.MapLayerMouseEvent)=>{
        const feature=e.features?.[0];if(!feature)return;
        const p=feature.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const title=document.createElement("strong");
        title.textContent=p.name||p.entityType||"CARE-Map item";
        const meta=document.createElement("div");
        meta.textContent=[p.entityType?.replace("_"," "),p.lga,p.status,p.riskLevel&&("Risk: "+p.riskLevel)].filter(Boolean).join(" • ");
        div.append(title,meta);
        const kindMap:Record<string,string>={borehole:"boreholes",asset:"assets",forest_site:"forest-sites",river:"rivers"};
        const publicKind=kindMap[String(p.entityType||"")];
        if(publicKind&&p.id){
          const link=document.createElement("a");
          link.href="/resource/"+publicKind+"/"+p.id;
          link.textContent="View public record";
          link.className="map-popup-link";
          div.append(link);
        }
        if(feature.geometry.type==="Point"){
          const c=(feature.geometry as GeoJSON.Point).coordinates;
          const coords=document.createElement("small");
          coords.textContent=Number(c[1]).toFixed(6)+", "+Number(c[0]).toFixed(6);
          div.append(coords);
        }
        new maplibregl.Popup({maxWidth:"320px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      };
      map.on("click","care-points",popup);
      map.on("click","care-lines",popup);
      map.on("click","care-polygons",popup);

      ["clusters","care-points","care-lines","care-polygons"].forEach(layer=>{
        map.on("mouseenter",layer,()=>{map.getCanvas().style.cursor="pointer";});
        map.on("mouseleave",layer,()=>{map.getCanvas().style.cursor="";});
      });
      loadFeatures(map);
    });
    map.on("moveend",()=>loadFeatures(map));
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{filterRef.current={type,lga,status};loadFeatures();},[type,lga,status]);

  return <div className="card">
    <div className="filters">
      <div className="field"><label>Layer</label><select value={type} onChange={e=>setType(e.target.value)}><option value="">All interventions</option><option value="borehole">Boreholes</option><option value="asset">Assets</option><option value="forest_site">Forests</option><option value="river">Rivers</option></select></div>
      <div className="field"><label>LGA</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">All LGAs</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Any status</option><option value="functional">Functional</option><option value="needs_maintenance">Needs maintenance</option><option value="non_functional">Non-functional</option></select></div>
      <div className="field"><label>Legend</label><div className="map-legend"><span><i className="legend-low"/>Low</span><span><i className="legend-medium"/>Medium</span><span><i className="legend-high"/>High</span><span><i className="legend-critical"/>Critical</span></div></div>
    </div>
    {error&&<div className="error">{error}</div>}
    <div ref={node} className="map-wrap" aria-label="CARE-Map interactive intervention map"/>
  </div>;
}
