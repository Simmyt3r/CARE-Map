"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource} from "maplibre-gl";
import {
  composerFeatureCounts,
  composerFilename,
  composerLayerOrder,
  featureCollection,
  filterComposerFeatures,
  type ComposerFeature,
  type ComposerLayer
} from "@/lib/map-composer";

type Lga={code:string;name:string};

const layerLabels:Record<ComposerLayer,string>={
  borehole:"Boreholes",
  asset:"Assets",
  forest_site:"Forests / afforestation",
  river:"Rivers",
  ndvi_change:"Vegetation change"
};

export default function MapComposer(){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const lgaRef=useRef("");
  const[lgas,setLgas]=useState<Lga[]>([]);
  const[rawFeatures,setRawFeatures]=useState<ComposerFeature[]>([]);
  const[layers,setLayers]=useState<ComposerLayer[]>([...composerLayerOrder]);
  const[lga,setLga]=useState("");
  const[risk,setRisk]=useState("");
  const[labels,setLabels]=useState(true);
  const[title,setTitle]=useState("Benue ACReSAL Operational Map");
  const[subtitle,setSubtitle]=useState("CARE-Map GIS situation map");
  const[notes,setNotes]=useState("");
  const[message,setMessage]=useState("");
  const[generatedAt,setGeneratedAt]=useState("");

  const visibleFeatures=useMemo(()=>filterComposerFeatures(rawFeatures,layers,risk),[rawFeatures,layers,risk]);
  const counts=useMemo(()=>composerFeatureCounts(visibleFeatures),[visibleFeatures]);
  const selectedLgaName=useMemo(()=>lgas.find(x=>x.code===lga)?.name||"All mapped areas",[lgas,lga]);

  const loadFeatures=useCallback(async(map=mapRef.current)=>{
    if(!map)return;
    const b=map.getBounds();
    const qs=new URLSearchParams({bbox:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(",")});
    if(lgaRef.current)qs.set("lga",lgaRef.current);
    try{
      const r=await fetch("/api/map/features?"+qs);
      if(!r.ok)throw new Error("Map data request failed.");
      const data=await r.json();
      setRawFeatures(Array.isArray(data.features)?data.features:[]);
      setMessage("");
    }catch(e){
      setMessage(e instanceof Error?e.message:"Map data could not be loaded.");
    }
  },[]);

  useEffect(()=>{
    setGeneratedAt(new Date().toLocaleString());
    fetch("/api/lgas").then(r=>r.json()).then(j=>setLgas(j.data||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!node.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:node.current,
      center:[8.7,7.35],
      zoom:6.5,
      preserveDrawingBuffer:true,
      style:{
        version:8,
        sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},
        layers:[{id:"osm",type:"raster",source:"osm"}]
      }
    });
    map.addControl(new maplibregl.NavigationControl(),"top-right");
    map.addControl(new maplibregl.ScaleControl({maxWidth:160,unit:"metric"}),"bottom-left");

    map.on("load",()=>{
      map.addSource("composer-data",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
      map.addLayer({
        id:"composer-polygons",type:"fill",source:"composer-data",
        filter:["in",["geometry-type"],["literal",["Polygon","MultiPolygon"]]],
        paint:{
          "fill-color":["match",["get","riskLevel"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#2f855a"],
          "fill-opacity":0.3,
          "fill-outline-color":"#ffffff"
        }
      });
      map.addLayer({
        id:"composer-lines",type:"line",source:"composer-data",
        filter:["in",["geometry-type"],["literal",["LineString","MultiLineString"]]],
        paint:{"line-color":"#2878a8","line-width":["interpolate",["linear"],["zoom"],6,2,13,5]}
      });
      map.addLayer({
        id:"composer-points",type:"circle",source:"composer-data",
        filter:["==",["geometry-type"],"Point"],
        paint:{
          "circle-radius":7,
          "circle-color":["match",["get","riskLevel"],"critical","#a61b1b","high","#db6d00","medium","#d6a600","#1f6b3b"],
          "circle-stroke-width":1.5,
          "circle-stroke-color":"#ffffff"
        }
      });
      map.addLayer({
        id:"composer-labels",type:"symbol",source:"composer-data",
        filter:["all",["has","name"],["!=",["get","name"],""]],
        layout:{
          "text-field":["get","name"],
          "text-size":["interpolate",["linear"],["zoom"],6,9,13,12],
          "text-offset":[0,1.1],
          "text-anchor":"top",
          "text-allow-overlap":false
        },
        paint:{"text-color":"#163426","text-halo-color":"#ffffff","text-halo-width":1.5}
      });

      const popup=(e:maplibregl.MapLayerMouseEvent)=>{
        const f=e.features?.[0];if(!f)return;
        const p=f.properties||{};
        const div=document.createElement("div");
        div.className="map-popup";
        const heading=document.createElement("strong");heading.textContent=p.name||p.entityType||"CARE-Map feature";
        const meta=document.createElement("div");
        meta.textContent=[p.entityType?.replaceAll("_"," "),p.status,p.riskLevel&&("Risk: "+p.riskLevel)].filter(Boolean).join(" • ");
        div.append(heading,meta);
        new maplibregl.Popup({maxWidth:"320px"}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      };
      ["composer-points","composer-lines","composer-polygons"].forEach(layer=>map.on("click",layer,popup));
      void loadFeatures(map);
    });

    const moveHandler=()=>void loadFeatures(map);
    map.on("moveend",moveHandler);
    mapRef.current=map;

    const resize=()=>window.setTimeout(()=>map.resize(),50);
    window.addEventListener("beforeprint",resize);
    window.addEventListener("afterprint",resize);

    return()=>{
      window.removeEventListener("beforeprint",resize);
      window.removeEventListener("afterprint",resize);
      map.off("moveend",moveHandler);
      map.remove();
      mapRef.current=null;
    };
  },[loadFeatures]);

  useEffect(()=>{
    const map=mapRef.current;
    const source=map?.getSource("composer-data") as GeoJSONSource|undefined;
    source?.setData(featureCollection(visibleFeatures) as any);
  },[visibleFeatures]);

  useEffect(()=>{
    const map=mapRef.current;
    if(map?.getLayer("composer-labels"))map.setLayoutProperty("composer-labels","visibility",labels?"visible":"none");
  },[labels]);

  useEffect(()=>{
    lgaRef.current=lga;
    void loadFeatures();
  },[lga,loadFeatures]);

  function toggleLayer(layer:ComposerLayer){
    setLayers(current=>current.includes(layer)?current.filter(x=>x!==layer):[...current,layer]);
  }

  function fitToData(){
    const map=mapRef.current;
    if(!map||!visibleFeatures.length)return setMessage("No visible features to fit.");
    let bounds:maplibregl.LngLatBounds|null=null;
    const visit=(value:any)=>{
      if(Array.isArray(value)&&value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){
        if(!bounds)bounds=new maplibregl.LngLatBounds([value[0],value[1]],[value[0],value[1]]);
        else bounds.extend([value[0],value[1]]);
        return;
      }
      if(Array.isArray(value))value.forEach(visit);
    };
    visibleFeatures.forEach(f=>visit(f.geometry?.coordinates));
    if(bounds)map.fitBounds(bounds,{padding:55,maxZoom:15});
  }

  function exportGeoJson(){
    const blob=new Blob([JSON.stringify(featureCollection(visibleFeatures),null,2)],{type:"application/geo+json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=composerFilename(title);a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),500);
  }


  return <div className="map-composer-page stack">
    <section className="card composer-controls print-hide stack">
      <div className="section-head">
        <div><h2>Map setup</h2><div className="muted">Compose the map, fit the extent, then print or save as PDF from your browser.</div></div>
        <span className="badge">{counts.total||0} visible features</span>
      </div>

      <div className="grid two">
        <div className="field"><label>Map title</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={140}/></div>
        <div className="field"><label>Subtitle</label><input value={subtitle} onChange={e=>setSubtitle(e.target.value)} maxLength={180}/></div>
      </div>

      <div className="grid three">
        <div className="field"><label>LGA filter</label><select value={lga} onChange={e=>setLga(e.target.value)}><option value="">All mapped areas</option>{lgas.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
        <div className="field"><label>Risk filter</label><select value={risk} onChange={e=>setRisk(e.target.value)}><option value="">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
        <label className="check-field composer-label-toggle"><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Show feature labels</label>
      </div>

      <div className="field"><label>Layers</label><div className="composer-layer-grid">
        {composerLayerOrder.map(layer=><label className="check-field" key={layer}><input type="checkbox" checked={layers.includes(layer)} onChange={()=>toggleLayer(layer)}/>{layerLabels[layer]}</label>)}
      </div></div>

      <div className="field"><label>Map notes / interpretation</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Purpose, reporting period, interpretation notes, caveats, source remarks…" maxLength={1200}/></div>

      <div className="actions map-composer-actions">
        <button className="btn" onClick={fitToData}>Fit visible data</button>
        <button className="btn" onClick={()=>void loadFeatures()}>Refresh data</button>
        <button className="btn" disabled={!visibleFeatures.length} onClick={exportGeoJson}>Export visible GeoJSON</button>
        <button className="btn primary" onClick={()=>window.print()}>Print / Save PDF</button>
      </div>
      {lga&&layers.includes("ndvi_change")&&<div className="notice">Published vegetation-change AOIs do not yet carry LGA metadata, so that layer is omitted while an LGA filter is active.</div>}
      {message&&<div className="error">{message}</div>}
    </section>

    <section className="map-print-sheet">
      <header className="composer-print-header">
        <div>
          <div className="composer-kicker">Benue ACReSAL · CARE-Map</div>
          <h1>{title||"CARE-Map Operational Map"}</h1>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        <div className="composer-print-meta">
          <strong>{selectedLgaName}</strong>
          <span>{risk?risk.charAt(0).toUpperCase()+risk.slice(1)+" risk only":"All risk levels"}</span>
          <span>Prepared {generatedAt}</span>
        </div>
      </header>

      <div className="composer-map-frame">
        <div ref={node} className="composer-map" aria-label="CARE-Map printable map composer"/>
        <div className="north-arrow" aria-hidden="true"><span>N</span><b>↑</b></div>
      </div>

      <div className="composer-summary">
        <div className="composer-counts">
          <span><strong>{counts.total||0}</strong>Total</span>
          <span><strong>{counts.borehole||0}</strong>Boreholes</span>
          <span><strong>{counts.asset||0}</strong>Assets</span>
          <span><strong>{counts.forest_site||0}</strong>Forests</span>
          <span><strong>{counts.river||0}</strong>Rivers</span>
          <span><strong>{counts.ndvi_change||0}</strong>Vegetation change</span>
        </div>
        <div className="composer-legends">
          <div><strong>Risk</strong><span><i className="legend-low"/>Low</span><span><i className="legend-medium"/>Medium</span><span><i className="legend-high"/>High</span><span><i className="legend-critical"/>Critical</span></div>
          <div><strong>Geometry</strong><span><i className="legend-point"/>Point feature</span><span><i className="legend-line"/>River / line</span><span><i className="legend-area"/>Area / change zone</span></div>
        </div>
      </div>

      {notes&&<div className="composer-notes"><strong>Map notes</strong><p>{notes}</p></div>}
      <footer className="composer-print-footer">Source: CARE-Map operational database and OpenStreetMap basemap. Map output should be interpreted with field verification and source-data quality in mind.</footer>
    </section>
  </div>;
}
