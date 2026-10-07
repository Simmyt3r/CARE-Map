"use client";
import {useEffect,useMemo,useState} from "react";
import LgaBoundaryManager from "@/components/LgaBoundaryManager";
import SettlementManager from "@/components/SettlementManager";
import HazardZoneManager from "@/components/HazardZoneManager";

type ImportKind="boreholes"|"assets"|"forest-sites"|"rivers";
type Quality={
  pointIssues:any[];
  possibleDuplicateBoreholes:any[];
  unverifiedRivers:any[];
  staleReports:any[];
  counts:{pointIssues:number;possibleDuplicates:number;unverifiedRivers:number;staleReports:number};
};

function parseCsv(text:string){
  const rows:string[][]=[];
  let row:string[]=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){
      if(quoted&&next==='"'){field+='"';i++;}
      else quoted=!quoted;
    }else if(ch===","&&!quoted){row.push(field);field="";}
    else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&next==="\n")i++;
      row.push(field);field="";
      if(row.some(x=>x.trim()!==""))rows.push(row);
      row=[];
    }else field+=ch;
  }
  if(field||row.length){row.push(field);if(row.some(x=>x.trim()!==""))rows.push(row);}
  if(rows.length<2)return[];
  const headers=rows[0].map(x=>x.trim());
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??"").trim()])));
}

function downloadText(filename:string,text:string,type:string){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}

export default function GISWorkbench(){
  const[kind,setKind]=useState<ImportKind>("boreholes");
  const[format,setFormat]=useState<"csv"|"geojson">("csv");
  const[rows,setRows]=useState<any[]>([]);
  const[features,setFeatures]=useState<any[]>([]);
  const[fileName,setFileName]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[quality,setQuality]=useState<Quality|null>(null);

  async function loadQuality(){
    const r=await fetch("/api/gis/quality");
    if(r.ok){const j=await r.json();setQuality(j.data);}
  }
  useEffect(()=>{loadQuality();},[]);

  useEffect(()=>{
    if(format==="csv"&&(kind==="forest-sites"||kind==="rivers"))setKind("boreholes");
  },[format,kind]);

  const preview=useMemo(()=>format==="csv"?rows.slice(0,8):features.slice(0,8),[format,rows,features]);
  const total=format==="csv"?rows.length:features.length;

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
    const text=await file.text();
    try{
      if(format==="csv"){const parsed=parseCsv(text);setRows(parsed);setFeatures([]);if(!parsed.length)setMessage("No data rows found in this CSV.");}
      else{
        const data=JSON.parse(text);
        if(data?.type!=="FeatureCollection"||!Array.isArray(data.features))throw new Error("GeoJSON must be a FeatureCollection.");
        setFeatures(data.features);setRows([]);
      }
    }catch(e){setRows([]);setFeatures([]);setMessage(e instanceof Error?e.message:"Could not read file.");}
  }

  async function importData(){
    if(!total)return;
    setBusy(true);setMessage("");
    const payload=format==="csv"?{kind,format,rows}:{kind,format,features};
    const r=await fetch("/api/gis/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Import failed.");
    setMessage("Imported "+j.data.imported+" of "+j.data.total+" records. "+j.data.failed+" failed.");
    await loadQuality();
  }

  function template(){
    const text=kind==="assets"
      ?"name,assetType,lgaCode,latitude,longitude,status,assetCode,description,gpsAccuracy,capturedAt\nExample Pump,Irrigation Pump,MAKURDI,7.7304,8.5361,functional,AST-001,Field asset,5.2,2026-10-06T12:00:00Z\n"
      :"name,lgaCode,latitude,longitude,status,boreholeCode,description,gpsAccuracy,capturedAt\nExample Borehole,MAKURDI,7.7304,8.5361,functional,BH-001,Community borehole,4.8,2026-10-06T12:00:00Z\n";
    downloadText(kind+"-template.csv",text,"text/csv");
  }

  return <div className="stack">
    <section className="card stack">
      <div className="section-head"><div><h2>Bulk GIS import</h2><div className="muted">Import field coordinates from CSV or GIS features from GeoJSON. Each batch is limited to 1,000 records and creates an audit trail.</div></div><span className="badge">{total} loaded</span></div>
      <div className="grid three">
        <div className="field"><label>Format</label><select value={format} onChange={e=>setFormat(e.target.value as "csv"|"geojson")}><option value="csv">CSV coordinates</option><option value="geojson">GeoJSON FeatureCollection</option></select></div>
        <div className="field"><label>Resource type</label><select value={kind} onChange={e=>setKind(e.target.value as ImportKind)}><option value="boreholes">Boreholes</option><option value="assets">Assets</option>{format==="geojson"&&<><option value="forest-sites">Forest / afforestation sites</option><option value="rivers">Rivers</option></>}</select></div>
        <div className="field"><label>File</label><input type="file" accept={format==="csv"?".csv,text/csv":".geojson,.json,application/geo+json,application/json"} onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>
      </div>
      {format==="csv"&&<div className="actions"><button className="btn" type="button" onClick={template}>Download CSV template</button></div>}
      {fileName&&<div className="notice"><strong>{fileName}</strong> · {total} records ready for validation/import.</div>}
      {!!preview.length&&<div className="table-wrap"><table><thead><tr>{format==="csv"?Object.keys(preview[0]).map(k=><th key={k}>{k}</th>):<><th>#</th><th>Geometry</th><th>Properties</th></>}</tr></thead><tbody>{format==="csv"?preview.map((r,i)=><tr key={i}>{Object.keys(preview[0]).map(k=><td key={k}>{String(r[k]??"")}</td>)}</tr>):preview.map((f,i)=><tr key={i}><td>{i+1}</td><td>{f.geometry?.type||"Missing"}</td><td><code>{JSON.stringify(f.properties||{}).slice(0,180)}</code></td></tr>)}</tbody></table></div>}
      <div className="actions"><button className="btn primary" disabled={busy||!total||total>1000} onClick={importData}>{busy?"Importing…":"Validate & import"}</button>{total>1000&&<span className="error">Split this file into batches of 1,000 or fewer.</span>}</div>
      {message&&<div className={message.startsWith("Imported")?"success":"notice"}>{message}</div>}
    </section>

    <LgaBoundaryManager/>

    <SettlementManager/>

    <HazardZoneManager/>

    <section className="card stack">
      <div className="section-head"><div><h2>GIS data quality</h2><div className="muted">Automated checks for weak GPS accuracy, missing maintenance, possible duplicate boreholes, unverified rivers, and stale community reports.</div></div><button className="btn" onClick={loadQuality}>Refresh checks</button></div>
      <div className="stats">
        <div className="stat"><strong>{quality?.counts.pointIssues??"–"}</strong><span>Point data issues</span></div>
        <div className="stat"><strong>{quality?.counts.possibleDuplicates??"–"}</strong><span>Possible duplicates</span></div>
        <div className="stat"><strong>{quality?.counts.unverifiedRivers??"–"}</strong><span>Unverified rivers</span></div>
        <div className="stat"><strong>{quality?.counts.staleReports??"–"}</strong><span>Stale reports</span></div>
      </div>
      {quality?.pointIssues?.length?<div className="table-wrap"><table><thead><tr><th>Type</th><th>Name</th><th>LGA</th><th>Issue</th><th>Accuracy</th></tr></thead><tbody>{quality.pointIssues.slice(0,30).map((r:any)=><tr key={r.entity_type+r.id}><td>{r.entity_type}</td><td>{r.name}</td><td>{r.lga_code}</td><td><span className="badge">{r.quality_issue}</span></td><td>{r.gps_accuracy_m?Number(r.gps_accuracy_m).toFixed(1)+" m":"Not recorded"}</td></tr>)}</tbody></table></div>:<div className="notice">No point-quality issues detected, or the database is not configured yet.</div>}
      {!!quality?.possibleDuplicateBoreholes?.length&&<div><h3>Possible duplicate boreholes</h3><div className="table-wrap"><table><thead><tr><th>Borehole A</th><th>Borehole B</th><th>LGA</th><th>Distance</th></tr></thead><tbody>{quality.possibleDuplicateBoreholes.map((r:any)=><tr key={r.a_id+r.b_id}><td>{r.a_name}</td><td>{r.b_name}</td><td>{r.lga_code}</td><td>{r.distance_m} m</td></tr>)}</tbody></table></div></div>}
    </section>

    <section className="card stack">
      <div><h2>Export for QGIS / analysis</h2><div className="muted">Download the current authoritative dataset for QGIS, ArcGIS, Excel, Python or archival work.</div></div>
      <div className="actions">
        <a className="btn primary" href="/api/gis/export?format=geojson&kind=all">Download GeoJSON</a>
        <a className="btn" href="/api/gis/export?format=csv&kind=all">Download CSV</a>
        <a className="btn" href="/api/gis/export?format=geojson&kind=boreholes">Boreholes only</a>
        <a className="btn" href="/api/gis/export?format=geojson&kind=assets">Assets only</a>
      </div>
    </section>
  </div>;
}
