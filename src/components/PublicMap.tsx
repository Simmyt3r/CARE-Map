"use client";
import {useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource} from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";
import {useI18n} from "@/components/LocalizationProvider";
import {vegetationSummary,type PublishedVegetationFeature} from "@/lib/vegetation-display";

type Lga={code:string;name:string};
type Filters={type:string;lga:string;status:string};

export default function PublicMap(){
  const{t}=useI18n();
  const tRef=useRef(t);
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const vegetationMarkers=useRef<maplibregl.Marker[]>([]);
  const filterRef=useRef<Filters>({type:"",lga:"",status:""});
  const boundaryByCodeRef=useRef<Record<string,any>>({});
  const[type,setType]=useState(""),[lga,setLga]=useState(""),[status,setStatus]=useState("");
  const[lgas,setLgas]=useState<Lga[]>([]),[hasError,setHasError]=useState(false);
  const[visibleNdvi,setVisibleNdvi]=useState<number|null>(null);
  const[locatingNdvi,setLocatingNdvi]=useState(false);
  const[ndviNotice,setNdviNotice]=useState("");
  const[publishedNdvi,setPublishedNdvi]=useState<PublishedVegetationFeature[]>([]);
  const[publishedLoading,setPublishedLoading]=useState(true);
  const[publishedError,setPublishedError]=useState("");

  useEffect(()=>{tRef.current=t;},[t]);
  useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});},[]);

  async function fetchPublishedVegetation():Promise<PublishedVegetationFeature[]>{
    setPublishedLoading(true);setPublishedError("");
    try{
      const response=await fetch("/api/map/features?type=ndvi_change",{cache:"no-store"});
      if(!response.ok)throw new Error("The public vegetation results are temporarily unavailable.");
      const data=await response.json();
      const features:PublishedVegetationFeature[]=Array.isArray(data.features)
        ?data.features.filter((f:PublishedVegetationFeature)=>f.properties?.entityType==="ndvi_change"):[];
      setPublishedNdvi(features);
      return features;
    }catch(e){
      setPublishedError(e instanceof Error?e.message:"Could not retrieve vegetation results.");
      return [];
    }finally{setPublishedLoading(false);}
  }

  function showVegetation(feature:PublishedVegetationFeature){
    const map=mapRef.current;
    const result=vegetationSummary(feature);
    if(!map||!result.extent)return;
    const [west,south,east,north]=result.extent;
    setType("ndvi_change");setStatus("");setLga("");
    filterRef.current={type:"ndvi_change",lga:"",status:""};
    map.fitBounds([[west,south],[east,north]],{padding:64,maxZoom:13,duration:400});
    setNdviNotice(result.name+": "+result.label.toLowerCase()+" "+result.metric+
      ". Tap the outlined area or map label to see the dates and details.");
    void loadFeatures(map);
  }

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
      const r=await fetch("/api/map/features?"+qs,{cache:"no-store"});
      if(!r.ok)throw new Error();
      const data=await r.json();
      const features=Array.isArray(data.features)?data.features:[];
      setVisibleNdvi(features.filter((x:any)=>x.properties?.entityType==="ndvi_change").length);
      const points={type:"FeatureCollection",features:features.filter((x:any)=>x.geometry?.type==="Point")} as any;
      const shapes={type:"FeatureCollection",features:features.filter((x:any)=>x.geometry?.type!=="Point")} as any;
      (map.getSource("carepoints") as GeoJSONSource|undefined)?.setData(points);
      (map.getSource("careshapes") as GeoJSONSource|undefined)?.setData(shapes);
      vegetationMarkers.current.forEach(marker=>marker.remove());
      vegetationMarkers.current=[];
      // HTML markers remain legible even at state-level zoom and do not need
      // external text glyph tiles.
      (features as PublishedVegetationFeature[])
        .filter(x=>x.properties?.entityType==="ndvi_change").slice(0,30)
        .forEach(feature=>{
          const result=vegetationSummary(feature);
          if(!result.center)return;
          const button=document.createElement("button");
          button.type="button";
          button.className="vegetation-map-marker vegetation-map-marker-"+result.direction;
          button.textContent=result.metric;
          button.title=result.name+" · "+result.label+" · "+(result.dates||"");
          button.setAttribute("aria-label",result.name+": "+result.label+" "+result.metric);
          const content=document.createElement("div");
          content.className="map-popup";
          const heading=document.createElement("strong");
          heading.textContent=result.name;
          const detail=document.createElement("p");
          detail.textContent=result.label+" · "+result.metric+
            (result.percentage?" ("+result.percentage+")":"")+
            (result.dates?" · "+result.dates:"");
          const note=document.createElement("small");
          note.textContent="Estimate for the whole outlined analysis area, not a pixel-level vegetation image.";
          content.append(heading,detail,note);
          const popup=new maplibregl.Popup({maxWidth:"300px"}).setDOMContent(content);
          vegetationMarkers.current.push(new maplibregl.Marker({element:button,anchor:"center"})
            .setLngLat(result.center).setPopup(popup).addTo(map));
        });
      setHasError(false);
    }catch{
      vegetationMarkers.current.forEach(marker=>marker.remove());
      vegetationMarkers.current=[];
      setHasError(true);setVisibleNdvi(null);
    }
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

      map.addLayer({id:"care-polygons",type:"fill",source:"careshapes",
        filter:["all",["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],["!=",["get","entityType"],"ndvi_change"]],
        paint:{"fill-color":"#2f855a","fill-opacity":0.26,"fill-outline-color":"#1f6b3b"}});
      // Vegetation changes need their own unmistakable public layer. Showing
      // them as ordinary green project polygons concealed actual results.
      const ndviPolygonFilter:any=["all",
        ["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],
        ["==",["get","entityType"],"ndvi_change"]];
      const ndviPaint:any=["match",["get","changeDirection"],
        "gain","#12914b","loss","#d45b33","stable","#577c88","#577c88"];
      map.addLayer({id:"ndvi-change-fill",type:"fill",source:"careshapes",
        filter:ndviPolygonFilter,
        paint:{"fill-color":ndviPaint,"fill-opacity":0.56}});
      map.addLayer({id:"ndvi-change-outline",type:"line",source:"careshapes",
        filter:ndviPolygonFilter,
        paint:{"line-color":ndviPaint,"line-width":3,"line-opacity":0.95}});
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
        if(p.entityType==="ndvi_change"){
          const signed=(value:any,suffix:string)=>{
            const n=Number(value);
            return value==null||!Number.isFinite(n)?"—":(n>0?"+":"")+n.toFixed(1)+suffix;
          };
          meta.textContent=[
            entityLabel("ndvi_change"),
            p.changeDirection==="gain"?"Vegetation gain":p.changeDirection==="loss"?"Vegetation loss":"No measured change",
            signed(p.changeHa," ha"),
            signed(p.changePct,"%"),
            p.baselineDate&&p.comparisonDate?String(p.baselineDate)+" to "+String(p.comparisonDate):null
          ].filter(Boolean).join(" • ");
        }else{
          meta.textContent=[
            p.entityType&&entityLabel(String(p.entityType)),
            p.lga,
            p.status&&statusLabel(String(p.status)),
            p.riskLevel&&(tx("map.risk")+": "+riskLabel(String(p.riskLevel)))
          ].filter(Boolean).join(" • ");
        }
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
      map.on("click","ndvi-change-fill",popup);

      ["clusters","care-points","care-lines","care-polygons","ndvi-change-fill"].forEach(layer=>{
        map.on("mouseenter",layer,()=>{map.getCanvas().style.cursor="pointer";});
        map.on("mouseleave",layer,()=>{map.getCanvas().style.cursor="";});
      });
      void loadBoundaries(map);
      void loadFeatures(map);
      void fetchPublishedVegetation();
    });
    map.on("moveend",()=>loadFeatures(map));
    mapRef.current=map;
    return()=>{vegetationMarkers.current.forEach(marker=>marker.remove());vegetationMarkers.current=[];map.remove();mapRef.current=null;};
  },[]);

  async function locatePublishedVegetation(){
    if(!mapRef.current||locatingNdvi)return;
    setLocatingNdvi(true);setNdviNotice("");
    const features=await fetchPublishedVegetation();
    if(features.length)showVegetation(features[0]);
    else setNdviNotice("No published approved vegetation-change areas were returned. Check the map service and try again.");
    setLocatingNdvi(false);
  }

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
    <section className="vegetation-map-spotlight" aria-label="Published satellite vegetation results">
      <div className="vegetation-spotlight-header">
        <div><span className="page-eyebrow">Satellite evidence · Sentinel-2</span>
          <h3>See where vegetation changed</h3>
          <p>Choose a published analysis to zoom to its boundary and read the estimated change.</p>
        </div>
        <button type="button" className="btn primary" disabled={locatingNdvi}
          onClick={()=>void locatePublishedVegetation()}>
          {locatingNdvi?"Locating areas…":"Show vegetation changes on map"}
        </button>
      </div>
      {publishedLoading&&<p className="muted" role="status">Loading approved vegetation analyses…</p>}
      {publishedError&&<p className="error" role="alert">{publishedError}</p>}
      {!publishedLoading&&!publishedError&&publishedNdvi.length===0&&
        <p className="muted">No approved vegetation comparisons have been published yet.</p>}
      {!!publishedNdvi.length&&<div className="vegetation-result-list">
        {publishedNdvi.slice(0,4).map(feature=>{
          const result=vegetationSummary(feature);
          return <button className={"vegetation-result vegetation-result-"+result.direction}
            key={feature.properties.id||feature.id} type="button"
            onClick={()=>showVegetation(feature)}>
            <span><strong>{result.name}</strong><small>{result.dates||"Published vegetation comparison"}</small></span>
            <span className="vegetation-result-metric">
              <strong>{result.metric}</strong><small>{result.label}{result.percentage?" · "+result.percentage:""}</small>
            </span>
            <span className="vegetation-result-arrow" aria-hidden="true">↗</span>
          </button>;
        })}
        {publishedNdvi.length>4&&<p className="muted">{publishedNdvi.length-4} more approved areas. Use the map layer to explore.</p>}
      </div>}
      <p className="vegetation-estimate-note">Colored boundaries summarize estimated vegetation-area change across each analysis area. They are not per-pixel satellite change images and do not prove an intervention caused the change. <a href="/extension#lesson-ndvi" style={{textDecoration:"underline",fontWeight:750}}>Learn how to read this map</a>.</p>
    </section>
    <div className="filters">
      <div className="field"><label>{t("map.layer")}</label><select value={type} onChange={e=>{const value=e.target.value;setType(value);if(value==="ndvi_change")setStatus("");setNdviNotice("");}}><option value="">{t("map.allInterventions")}</option><option value="borehole">{t("map.boreholes")}</option><option value="asset">{t("map.assets")}</option><option value="forest_site">{t("map.forests")}</option><option value="river">{t("map.rivers")}</option><option value="ndvi_change">{t("map.vegetationChange")}</option></select></div>
      <div className="field"><label>{t("map.lga")}</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">{t("map.allLgas")}</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div className="field"><label>{t("map.status")}</label><select value={status} disabled={type==="ndvi_change"} onChange={e=>setStatus(e.target.value)}><option value="">{t("map.anyStatus")}</option><option value="functional">{t("map.functional")}</option><option value="needs_maintenance">{t("map.needsMaintenance")}</option><option value="non_functional">{t("map.nonFunctional")}</option></select></div>
      <div className="field"><label>{t("map.legend")}</label><div className="map-legend"><span><i className="legend-low"/>{t("map.low")}</span><span><i className="legend-medium"/>{t("map.medium")}</span><span><i className="legend-high"/>{t("map.high")}</span><span><i className="legend-critical"/>{t("map.critical")}</span></div></div>
    </div>
    <div className="map-vegetation-tools">
      <div className="map-vegetation-legend" aria-label="Vegetation change legend">
        <strong>Sentinel-2 vegetation change</strong>
        <span><i className="vegetation-gain"/> Gain</span>
        <span><i className="vegetation-loss"/> Loss</span>
        <span><i className="vegetation-stable"/> No measured change</span>
      </div>
      <button className="btn" type="button" onClick={()=>void locatePublishedVegetation()} disabled={locatingNdvi}>
        {locatingNdvi?"Finding published layers…":"Find published vegetation change"}
      </button>
    </div>
    {type==="ndvi_change"&&<div className="muted" role="status">
      {visibleNdvi===null?"Checking vegetation layer…":visibleNdvi===0
        ?"No published vegetation-change polygons in the current map view. Use Find published vegetation change to locate approved areas."
        :visibleNdvi+" approved vegetation-change polygon(s) in the current map view."}
    </div>}
    {ndviNotice&&<div className="notice" role="status">{ndviNotice}</div>}
    {hasError&&<div className="error" role="alert">{t("map.dataError")}. Retry the layer or refresh this page.</div>}
    <div ref={node} className="map-wrap" aria-label={t("map.aria")}/>
  </div>;
}
