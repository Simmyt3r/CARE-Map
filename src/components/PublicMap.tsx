"use client";
import {useEffect,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource} from "maplibre-gl";
import {geometryExtent} from "@/lib/geojson";
import {useI18n} from "@/components/LocalizationProvider";
import {vegetationSummary,type PublishedVegetationFeature} from "@/lib/vegetation-display";
import {deploymentProfile} from "@/lib/deployment-profile";
import type {PublicMapCounts,PublicMapCategory} from "@/lib/map-public-counts";
import {safePublicMapImageUrl} from "@/lib/public-map-images";

type Lga={code:string;name:string};
type Filters={type:string;lga:string;status:string};

export default function PublicMap(){
  const{t}=useI18n();
  const tRef=useRef(t);
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const vegetationMarkers=useRef<maplibregl.Marker[]>([]);
  const featureAbort=useRef<AbortController|null>(null);
  const featureTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
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
  const[counts,setCounts]=useState<{counts:PublicMapCounts;physicalTotal:number;satelliteTotal:number}|null>(null);
  const[countBusy,setCountBusy]=useState(true);
  const[countError,setCountError]=useState("");
  const[viewportCount,setViewportCount]=useState<number|null>(null);
  const firstLgaEffect=useRef(false);


  useEffect(()=>{tRef.current=t;},[t]);
  useEffect(()=>{fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});},[]);

  useEffect(()=>{
    const controller=new AbortController();
    setCountBusy(true);setCountError("");
    const params=new URLSearchParams();
    if(lga)params.set("lga",lga);
    if(status&&type!=="ndvi_change")params.set("status",status);
    void fetch("/api/map/counts"+(params.size?"?"+params.toString():""),{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error("Map counts are temporarily unavailable.");
        return response.json();
      }).then(json=>{
        if(!controller.signal.aborted)setCounts(json.data);
      }).catch(()=>{
        if(!controller.signal.aborted){setCountError("Could not load intervention counts.");setCounts(null);}
      }).finally(()=>{if(!controller.signal.aborted)setCountBusy(false);});
    return()=>controller.abort();
  },[lga,status,type==="ndvi_change"]);

  // Published NDVI statistics are a separate data layer. LGA filters must
  // apply to its source and markers too; other filters hide the layer entirely.
  useEffect(()=>{
    if(!firstLgaEffect.current){firstLgaEffect.current=true;return;}
    void fetchPublishedVegetation(lga);
  },[lga]);

  async function fetchPublishedVegetation(lgaCode=filterRef.current.lga):Promise<PublishedVegetationFeature[]>{
    setPublishedLoading(true);setPublishedError("");
    try{
      const params=new URLSearchParams({type:"ndvi_change"});
      if(lgaCode)params.set("lga",lgaCode);
      const response=await fetch("/api/map/features?"+params.toString());
      if(!response.ok)throw new Error("The public vegetation results are temporarily unavailable.");
      const data=await response.json();
      const features:PublishedVegetationFeature[]=Array.isArray(data.features)
        ?data.features.filter((f:PublishedVegetationFeature)=>f.properties?.entityType==="ndvi_change"):[];
      setPublishedNdvi(features);
      setVisibleNdvi(features.length);
      const map=mapRef.current;
      const source=map?.getSource("published-vegetation") as GeoJSONSource|undefined;
      source?.setData({type:"FeatureCollection",features} as GeoJSON.FeatureCollection);
      if(map)updateVegetationMarkers(map,features);
      return features;
    }catch(e){
      setPublishedError(e instanceof Error?e.message:"Could not retrieve vegetation results.");
      setVisibleNdvi(null);
      return [];
    }finally{setPublishedLoading(false);}
  }

  function updateVegetationMarkers(map:maplibregl.Map,features:PublishedVegetationFeature[]){
    vegetationMarkers.current.forEach(marker=>marker.remove());
    vegetationMarkers.current=[];
    for(const feature of features.slice(0,50)){
      const result=vegetationSummary(feature);
      if(!result.center)continue;
      const button=document.createElement("button");
      button.type="button";
      button.className="vegetation-map-marker vegetation-map-marker-"+result.direction;
      button.textContent=result.metric;
      button.title=result.name+" · "+result.location+" · "+result.label+" · "+(result.dates||"");
      button.setAttribute("aria-label",result.name+": "+result.label+" "+result.metric);
      button.style.display=filterRef.current.type==="ndvi_change"?"":"none";
      const content=document.createElement("div");
      content.className="map-popup";
      const heading=document.createElement("strong");
      heading.textContent=result.name;
      const detail=document.createElement("p");
      detail.textContent=result.location+" · "+result.label+" · "+result.metric+
        (result.percentage?" ("+result.percentage+")":"")+
        (result.dates?" · "+result.dates:"");
      const note=document.createElement("small");
      note.textContent="Satellite estimate for the full analysis boundary. It is not a pixel-by-pixel change map.";
      content.append(heading,detail,note);
      const popup=new maplibregl.Popup({maxWidth:"300px"}).setDOMContent(content);
      vegetationMarkers.current.push(new maplibregl.Marker({element:button,anchor:"center"})
        .setLngLat(result.center).setPopup(popup).addTo(map));
    }
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

  function scheduleFeatures(map=mapRef.current){
    if(featureTimer.current!==null)clearTimeout(featureTimer.current);
    featureTimer.current=setTimeout(()=>{featureTimer.current=null;void loadFeatures(map);},350);
  }

  async function loadFeatures(map=mapRef.current){
    if(!map)return;
    featureAbort.current?.abort();
    featureAbort.current=null;
    const b=map.getBounds(),f=filterRef.current;
    if(f.type==="ndvi_change"){
      setViewportCount(null);
      (map.getSource("carepoints") as GeoJSONSource|undefined)
        ?.setData({type:"FeatureCollection",features:[]} as GeoJSON.FeatureCollection);
      (map.getSource("careshapes") as GeoJSONSource|undefined)
        ?.setData({type:"FeatureCollection",features:[]} as GeoJSON.FeatureCollection);
      setHasError(false);
      return;
    }
    const qs=new URLSearchParams({bbox:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(",")});
    qs.set("type",f.type||"all_resources");
    if(f.lga)qs.set("lga",f.lga);
    if(f.status)qs.set("status",f.status);
    const controller=new AbortController();
    featureAbort.current=controller;
    try{
      const r=await fetch("/api/map/features?"+qs,{signal:controller.signal});
      if(!r.ok)throw new Error();
      const data=await r.json();
      if(controller.signal.aborted)return;
      const features=Array.isArray(data.features)?data.features:[];
      setViewportCount(features.length);
      const points={type:"FeatureCollection",features:features.filter((x:any)=>x.geometry?.type==="Point")} as any;
      const shapes={type:"FeatureCollection",features:features.filter((x:any)=>
        x.geometry?.type!=="Point"&&x.properties?.entityType!=="ndvi_change")} as any;
      (map.getSource("carepoints") as GeoJSONSource|undefined)?.setData(points);
      (map.getSource("careshapes") as GeoJSONSource|undefined)?.setData(shapes);
      setHasError(false);
    }catch(e){
      if(!controller.signal.aborted){setHasError(true);setViewportCount(null);}
    }finally{
      if(featureAbort.current===controller)featureAbort.current=null;
    }
  }

  useEffect(()=>{
    if(!node.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:deploymentProfile.mapCenter,
      zoom:deploymentProfile.mapZoom,
      style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm"}]}
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      map.addSource("lga-boundaries",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addSource("carepoints",{type:"geojson",data:{type:"FeatureCollection",features:[]},cluster:true,clusterRadius:46,clusterMaxZoom:13});
      map.addSource("careshapes",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addSource("published-vegetation",{type:"geojson",
        data:{type:"FeatureCollection",features:[]}});

      map.addLayer({id:"lga-boundary-fill",type:"fill",source:"lga-boundaries",filter:["==",["get","code"],"__NONE__"],paint:{"fill-color":"#244d35","fill-opacity":0.09}});
      map.addLayer({id:"lga-boundary-lines",type:"line",source:"lga-boundaries",paint:{"line-color":"#355f46","line-width":["interpolate",["linear"],["zoom"],6,1,12,2],"line-opacity":0.7}});

      map.addLayer({id:"care-polygons",type:"fill",source:"careshapes",
        filter:["all",["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],["!=",["get","entityType"],"ndvi_change"]],
        paint:{"fill-color":"#2f855a","fill-opacity":0.26,"fill-outline-color":"#1f6b3b"}});
      // Vegetation changes need their own unmistakable public layer. Showing
      // them as ordinary green project polygons concealed actual results.
      const ndviPaint:any=["match",["get","changeDirection"],
        "gain","#16a34a","loss","#e36432","stable","#578899","#578899"];
      map.addLayer({id:"ndvi-change-fill",type:"fill",source:"published-vegetation",
        layout:{visibility:"none"},
        paint:{"fill-color":ndviPaint,"fill-opacity":0.48}});
      map.addLayer({id:"ndvi-change-outline",type:"line",source:"published-vegetation",
        layout:{visibility:"none"},
        paint:{"line-color":ndviPaint,"line-width":5,"line-opacity":1}});
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
        const imageUrl=safePublicMapImageUrl(p.imageUrl);
        if(imageUrl&&p.entityType!=="ndvi_change"){
          const photo=document.createElement("img");
          photo.className="map-popup-image";
          photo.src=imageUrl;
          photo.alt="Public resource photograph: "+(p.name||"mapped site");
          photo.loading="lazy";
          photo.referrerPolicy="no-referrer";
          photo.onerror=()=>{photo.remove();};
          div.append(photo);
          if(typeof p.imageCaption==="string"&&p.imageCaption.trim()){
            const caption=document.createElement("small");
            caption.className="map-popup-image-caption";
            caption.textContent=p.imageCaption;
            div.append(caption);
          }
        }
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
      scheduleFeatures(map);
      void fetchPublishedVegetation();
    });
    map.on("moveend",()=>scheduleFeatures(map));
    mapRef.current=map;
    return()=>{
      if(featureTimer.current!==null)clearTimeout(featureTimer.current);
      featureAbort.current?.abort();
      vegetationMarkers.current.forEach(marker=>marker.remove());
      vegetationMarkers.current=[];map.remove();mapRef.current=null;
    };
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
    for(const layer of ["ndvi-change-fill","ndvi-change-outline"]){
      if(map?.getLayer(layer)){
        map.setLayoutProperty(layer,"visibility",type==="ndvi_change"?"visible":"none");
      }
    }
    vegetationMarkers.current.forEach(marker=>{
      marker.getElement().style.display=type==="ndvi_change"?"":"none";
    });
    scheduleFeatures();
  },[type,lga,status]);

  const countKeys:{kind:PublicMapCategory;label:string}[]=[
    {kind:"borehole",label:t("map.boreholes")},
    {kind:"asset",label:t("map.assets")},
    {kind:"forest_site",label:t("map.forests")},
    {kind:"river",label:t("map.rivers")},
    {kind:"ndvi_change",label:t("map.vegetationChange")}
  ];
  const selectedCount=counts
    ?type?counts.counts[type as PublicMapCategory]:counts.physicalTotal
    :null;
  function chooseType(value:string){
    setType(value);
    if(value==="ndvi_change")setStatus("");
    setNdviNotice("");
  }

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
      {publishedError&&<div className="error" role="alert">{publishedError}
        <button type="button" className="btn" onClick={()=>void fetchPublishedVegetation()}>
          Retry vegetation layer
        </button>
      </div>}
      {!publishedLoading&&!publishedError&&publishedNdvi.length===0&&
        <p className="muted">No approved vegetation comparisons have been published yet.</p>}
      {!!publishedNdvi.length&&<div className="vegetation-result-list">
        {publishedNdvi.slice(0,4).map(feature=>{
          const result=vegetationSummary(feature);
          return <button className={"vegetation-result vegetation-result-"+result.direction}
            key={feature.properties.id||feature.id} type="button"
            onClick={()=>showVegetation(feature)}>
            <span><strong>{result.name}</strong><small>{result.location}</small><small>{result.dates||"Published vegetation comparison"}</small></span>
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
      <div className="field"><label>{t("map.layer")}</label><select value={type} onChange={e=>chooseType(e.target.value)}><option value="">{t("map.allInterventions")}</option><option value="borehole">{t("map.boreholes")}</option><option value="asset">{t("map.assets")}</option><option value="forest_site">{t("map.forests")}</option><option value="river">{t("map.rivers")}</option><option value="ndvi_change">{t("map.vegetationChange")}</option></select></div>
      <div className="field"><label>{t("map.lga")}</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">{t("map.allLgas")}</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div className="field"><label>{t("map.status")}</label><select value={status} disabled={type==="ndvi_change"} onChange={e=>setStatus(e.target.value)}><option value="">{t("map.anyStatus")}</option><option value="functional">{t("map.functional")}</option><option value="needs_maintenance">{t("map.needsMaintenance")}</option><option value="non_functional">{t("map.nonFunctional")}</option></select></div>
      <div className="field"><label>{t("map.legend")}</label><div className="map-legend"><span><i className="legend-low"/>{t("map.low")}</span><span><i className="legend-medium"/>{t("map.medium")}</span><span><i className="legend-high"/>{t("map.high")}</span><span><i className="legend-critical"/>{t("map.critical")}</span></div></div>
    </div>
    <section className="map-intervention-counts" aria-label="Counts for selected map filters">
      <div className="map-count-head">
        <strong>Mapped intervention and resource counts</strong>
        <span className="muted" role="status">{countBusy?"Updating counts…":countError||
          (selectedCount===null?"Totals unavailable":selectedCount.toLocaleString("en-NG")+" matching "+(type==="ndvi_change"?"published satellite analyses":"mapped resource records"))}</span>
      </div>
      <div className="map-count-categories">
        <button className="map-count-option" type="button" aria-pressed={!type}
          onClick={()=>chooseType("")}>
          <span>All physical resources</span><strong>{counts?counts.physicalTotal.toLocaleString("en-NG"):"—"}</strong>
        </button>
        {countKeys.map(item=><button className="map-count-option" type="button"
            key={item.kind} aria-pressed={type===item.kind}
            onClick={()=>chooseType(item.kind)}>
          <span>{item.label}</span>
          <strong>{counts?counts.counts[item.kind].toLocaleString("en-NG"):"—"}</strong>
        </button>)}
      </div>
      <p className="muted map-count-explanation">
        Totals reflect the selected {lga?"LGA":"state"}{status&&type!=="ndvi_change"?" and status":""}, not just the visible map.
        Satellite observations are counted separately from physical resources.
        {viewportCount!==null&&type!=="ndvi_change"?
          " "+viewportCount+" map record(s) currently loaded within the visible area.":""}
      </p>
    </section>
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
      {visibleNdvi===null?"Vegetation layer could not be loaded. Retry above.":visibleNdvi===0
        ?"No published approved vegetation-change polygons currently available."
        :visibleNdvi+" approved vegetation-change polygon(s) available. Use the result card to locate each area."}
    </div>}
    {ndviNotice&&<div className="notice" role="status">{ndviNotice}</div>}
    {hasError&&<div className="error" role="alert">{t("map.dataError")}. Retry the layer or refresh this page.</div>}
    <div ref={node} className="map-wrap" aria-label={t("map.aria")}/>
  </div>;
}
