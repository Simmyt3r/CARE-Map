"use client";
import {useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource} from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";
import {useI18n} from "@/components/LocalizationProvider";

type Lga={code:string;name:string};
type Filters={type:string;lga:string;status:string};

export default function PublicMap(){
  const{t}=useI18n();
  const tRef=useRef(t);
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const filterRef=useRef<Filters>({type:"",lga:"",status:""});
  const boundaryByCodeRef=useRef<Record<string,any>>({});
  const[type,setType]=useState(""),[lga,setLga]=useState(""),[status,setStatus]=useState("");
  const[lgas,setLgas]=useState<Lga[]>([]),[hasError,setHasError]=useState(false);

  useEffect(()=>{tRef.current=t;},[t]);
  useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});},[]);

  async function loadBoundaries(map=mapRef.current){
    if(!map)return;
    try{
      const r=await fetch("/api/gis/lga-boundaries");
      if(!r.ok)return;
      const data=await r.json();
      const features=Array.isArray(data.features)?data.features:[];
      boundaryByCodeRef.current=Object.fromEntries(features.map((feature:any)=>[feature.properties?.code,feature]));
      (map.getSource("lga-boundaries") as GeoJSONSource|undefined)?.setData({type:"FeatureCollection",features} as any);
      const selected=filterRef.current.lga;
      if(selected){
        if(map.getLayer("lga-boundary-fill"))map.setFilter("lga-boundary-fill",["==",["get","code"],selected]);
        const extent=geometryExtent(boundaryByCodeRef.current[selected]?.geometry);
        if(extent)map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
      }
    }catch{}
  }

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
      setHasError(false);
    }catch{setHasError(true);}
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
      map.addSource("lga-boundaries",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addSource("carepoints",{type:"geojson",data:{type:"FeatureCollection",features:[]},cluster:true,clusterRadius:46,clusterMaxZoom:13});
      map.addSource("careshapes",{type:"geojson",data:{type:"FeatureCollection",features:[]}});

      map.addLayer({id:"lga-boundary-fill",type:"fill",source:"lga-boundaries",filter:["==",["get","code"],"__NONE__"],paint:{"fill-color":"#244d35","fill-opacity":0.09}});
      map.addLayer({id:"lga-boundary-lines",type:"line",source:"lga-boundaries",paint:{"line-color":"#355f46","line-width":["interpolate",["linear"],["zoom"],6,1,12,2],"line-opacity":0.7}});

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
        const tx=tRef.current;
        const entityLabel=(value:string)=>{
          if(value==="borehole")return tx("map.boreholes");
          if(value==="asset")return tx("map.assets");
          if(value==="forest_site")return tx("map.forests");
          if(value==="river")return tx("map.rivers");
          if(value==="ndvi_change")return tx("map.vegetationChange");
          return value.replaceAll("_"," ");
        };
        const statusLabel=(value:string)=>{
          if(value==="functional")return tx("map.functional");
          if(value==="needs_maintenance")return tx("map.needsMaintenance");
          if(value==="non_functional")return tx("map.nonFunctional");
          return value.replaceAll("_"," ");
        };
        const riskLabel=(value:string)=>{
          if(value==="low")return tx("map.low");
          if(value==="medium")return tx("map.medium");
          if(value==="high")return tx("map.high");
          if(value==="critical")return tx("map.critical");
          return value;
        };
        title.textContent=p.name||entityLabel(String(p.entityType||""))||tx("map.item");
        const meta=document.createElement("div");
        meta.textContent=[
          p.entityType&&entityLabel(String(p.entityType)),
          p.lga,
          p.status&&statusLabel(String(p.status)),
          p.riskLevel&&(tx("map.risk")+": "+riskLabel(String(p.riskLevel)))
        ].filter(Boolean).join(" • ");
        div.append(title,meta);
        const kindMap:Record<string,string>={borehole:"boreholes",asset:"assets",forest_site:"forest-sites",river:"rivers"};
        const publicKind=kindMap[String(p.entityType||"")];
        if(publicKind&&p.id){
          const link=document.createElement("a");
          link.href="/resource/"+publicKind+"/"+p.id;
          link.textContent=tx("map.viewRecord");
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
      void loadBoundaries(map);
      void loadFeatures(map);
    });
    map.on("moveend",()=>loadFeatures(map));
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    filterRef.current={type,lga,status};
    const map=mapRef.current;
    if(map?.getLayer("lga-boundary-fill")){
      map.setFilter("lga-boundary-fill",["==",["get","code"],lga||"__NONE__"]);
    }
    if(lga&&map){
      const feature=boundaryByCodeRef.current[lga];
      const extent=geometryExtent(feature?.geometry);
      if(extent)map.fitBounds([[extent[0],extent[1]],[extent[2],extent[3]]],{padding:42,maxZoom:12});
    }
    void loadFeatures();
  },[type,lga,status]);

  return <div className="card">
    <div className="filters">
      <div className="field"><label>{t("map.layer")}</label><select value={type} onChange={e=>setType(e.target.value)}><option value="">{t("map.allInterventions")}</option><option value="borehole">{t("map.boreholes")}</option><option value="asset">{t("map.assets")}</option><option value="forest_site">{t("map.forests")}</option><option value="river">{t("map.rivers")}</option><option value="ndvi_change">{t("map.vegetationChange")}</option></select></div>
      <div className="field"><label>{t("map.lga")}</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">{t("map.allLgas")}</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div className="field"><label>{t("map.status")}</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t("map.anyStatus")}</option><option value="functional">{t("map.functional")}</option><option value="needs_maintenance">{t("map.needsMaintenance")}</option><option value="non_functional">{t("map.nonFunctional")}</option></select></div>
      <div className="field"><label>{t("map.legend")}</label><div className="map-legend"><span><i className="legend-low"/>{t("map.low")}</span><span><i className="legend-medium"/>{t("map.medium")}</span><span><i className="legend-high"/>{t("map.high")}</span><span><i className="legend-critical"/>{t("map.critical")}</span></div></div>
    </div>
    {hasError&&<div className="error">{t("map.dataError")}</div>}
    <div ref={node} className="map-wrap" aria-label={t("map.aria")}/>
  </div>;
}
