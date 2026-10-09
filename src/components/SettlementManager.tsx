"use client";
import {useCallback,useMemo,useState,useEffect,useRef} from "react";

type ImportFormat="csv"|"geojson";
type ImportProgress={processed:number;total:number;imported:number;skipped:number;failed:number;autoAssignedLga:number;batches:number;errors:{row:number;message:string}[]};
const CHUNK_SIZE=100;

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

function download(filename:string,text:string,type:string){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function SettlementManager(){
  const[format,setFormat]=useState<ImportFormat>("csv");
  const[source,setSource]=useState("");
  const[defaultPopulationSource,setDefaultPopulationSource]=useState("");
  const[defaultPopulationYear,setDefaultPopulationYear]=useState("");
  const[verified,setVerified]=useState(false);
  const[rows,setRows]=useState<any[]>([]);
  const[features,setFeatures]=useState<any[]>([]);
  const[fileName,setFileName]=useState("");
  const[summary,setSummary]=useState<any|null>(null);
  const[recent,setRecent]=useState<any[]>([]);
  const[imports,setImports]=useState<any[]>([]);
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[cursor,setCursor]=useState(0);
  const[progress,setProgress]=useState<ImportProgress|null>(null);
  const[paused,setPaused]=useState(false);
  const stopAfterBatch=useRef(false);
  const resetProgress=()=>{setCursor(0);setProgress(null);setPaused(false);stopAfterBatch.current=false;};

  const load=useCallback(async()=>{
    const r=await fetch("/api/gis/settlements");
    const j=await r.json().catch(()=>({}));
    if(r.ok){setSummary(j.summary||null);setRecent(j.data||[]);setImports(j.imports||[]);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const items=format==="csv"?rows:features;
  const preview=useMemo(()=>items.slice(0,8),[items]);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);resetProgress();
    try{
      const text=await file.text();
      if(format==="csv"){
        const parsed=parseCsv(text);
        if(!parsed.length)throw new Error("CSV contains no data rows.");
        if(parsed.length>2000)throw new Error("Settlement import is limited to 2,000 rows per batch.");
        setRows(parsed);setFeatures([]);
      }else{
        const data=JSON.parse(text);
        if(data?.type!=="FeatureCollection"||!Array.isArray(data.features)){
          throw new Error("GeoJSON must be a FeatureCollection.");
        }
        if(!data.features.length)throw new Error("GeoJSON contains no features.");
        if(data.features.length>2000)throw new Error("Settlement import is limited to 2,000 features per batch.");
        setFeatures(data.features);setRows([]);
      }
    }catch(e){
      setRows([]);setFeatures([]);
      setMessage(e instanceof Error?e.message:"Could not read settlement file.");
    }
  }

  async function importSettlements(){
    if(busy||!items.length||!source.trim()||cursor>=items.length)return;
    setBusy(true);setPaused(false);setMessage("");
    stopAfterBatch.current=false;
    const total=items.length;
    let next=cursor;
    const aggregate:ImportProgress=progress?{...progress,errors:[...progress.errors]}:{
      processed:0,total,imported:0,skipped:0,failed:0,autoAssignedLga:0,batches:0,errors:[]
    };
    try{
      while(next<total){
        if(stopAfterBatch.current){setPaused(true);break;}
        const batch=items.slice(next,next+CHUNK_SIZE);
        const payload={
          source:source.trim(),format,verified,
          defaultPopulationSource:defaultPopulationSource.trim()||null,
          defaultPopulationYear:defaultPopulationYear.trim()||null,
          ...(format==="csv"?{rows:batch}:{features:batch})
        };
        const batchNumber=Math.floor(next/CHUNK_SIZE)+1;
        let response:Response;
        try{
          response=await fetch("/api/gis/settlements/import",{
            method:"POST",headers:{"content-type":"application/json"},
            body:JSON.stringify(payload),cache:"no-store"
          });
        }catch{
          throw new Error("Network error in batch "+batchNumber+". Previous batches remain saved. Select Resume import to safely retry.");
        }
        const result=await response.json().catch(()=>({}));
        if(!response.ok){
          const detail=String(result.error?.message||result.message||"HTTP "+response.status);
          throw new Error("Batch "+batchNumber+" failed: "+detail+". Resume import to retry this batch.");
        }
        const d=result.data||{};
        next+=batch.length;
        aggregate.processed=next;
        aggregate.imported+=Number(d.imported||0);
        aggregate.skipped+=Number(d.skipped||0);
        aggregate.failed+=Number(d.failed||0);
        aggregate.autoAssignedLga+=Number(d.autoAssignedLga||0);
        aggregate.batches++;
        if(Array.isArray(d.errors)){
          for(const e of d.errors){
            aggregate.errors.push({row:next-batch.length+Number(e.row||0),message:String(e.message||"Invalid record")});
          }
        }
        setCursor(next);
        setProgress({...aggregate,errors:[...aggregate.errors]});
      }
      if(next>=total){
        setMessage("Import complete: "+aggregate.imported+" added, "+aggregate.skipped+
          " duplicates skipped, "+aggregate.failed+" rejected. "+
          aggregate.autoAssignedLga+" LGA assignments calculated.");
      }else if(stopAfterBatch.current){
        setMessage("Import paused after "+next+" of "+total+" records. Use Resume import when ready.");
      }
    }catch(e){
      setPaused(true);
      setMessage(e instanceof Error?e.message:"Import interrupted. Resume from the last confirmed batch.");
    }finally{
      setBusy(false);
      await load();
    }
  }

  function downloadErrors(){
    if(!progress?.errors.length)return;
    const csvEscape=(value:string)=>JSON.stringify(value);
    download("care-map-settlement-import-errors.csv",
      "row,error\n"+progress.errors.map(e=>e.row+","+csvEscape(e.message)).join("\n")+"\n","text/csv");
  }

  async function toggleVerified(row:any){
    const r=await fetch("/api/gis/settlements/"+row.id,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({verified:!row.verified})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Settlement verification update failed.");
    setMessage(row.verified?"Settlement marked unverified.":"Settlement verified.");
    await load();
  }

  function template(){
    const csv=[
      "settlementCode,name,settlementType,lgaCode,latitude,longitude,population,populationYear,populationSource,gpsAccuracy,notes",
      "SET-001,Example Community,community,MAKURDI,7.7304,8.5361,2500,2024,Approved survey,5.0,Example only"
    ].join("\n")+"\n";
    download("care-map-settlements-template.csv",csv,"text/csv");
  }

  async function exportGeoJson(){
    const r=await fetch("/api/gis/settlements?format=geojson");
    if(!r.ok)return setMessage("Settlement export failed.");
    const j=await r.json();
    download("care-map-settlements.geojson",JSON.stringify(j,null,2),"application/geo+json");
  }

  return <section className="card stack">
    <div className="section-head">
      <div><h2>Settlements & communities</h2><div className="muted">Import point locations with provenance. Population is optional and remains explicitly sourced when present.</div></div>
      <button className="btn" onClick={load}>Refresh</button>
    </div>

    <div className="stats settlement-stats">
      <div className="stat"><strong>{summary?.total??"–"}</strong><span>Settlements</span></div>
      <div className="stat"><strong>{summary?.verified??"–"}</strong><span>Verified</span></div>
      <div className="stat"><strong>{summary?.population_known??"–"}</strong><span>Population known</span></div>
      <div className="stat"><strong>{summary?.lgas_covered??"–"}</strong><span>LGAs represented</span></div>
      <div className="stat"><strong>{summary?.source_datasets??"–"}</strong><span>Source datasets</span></div>
    </div>

    <div className="notice"><strong>Verification rule:</strong> keep the batch unverified unless the source and coordinates have been reviewed. Access analysis uses verified settlements by default.</div>

    <div className="grid two">
      <div className="field"><label>Import format</label><select value={format} disabled={busy} onChange={e=>{setFormat(e.target.value as ImportFormat);setRows([]);setFeatures([]);setFileName("");resetProgress();}}>
        <option value="csv">CSV coordinates</option>
        <option value="geojson">GeoJSON points</option>
      </select></div>
      <div className="field"><label>Dataset source / provenance</label><input value={source} disabled={busy} onChange={e=>{setSource(e.target.value);resetProgress();}} placeholder="e.g. Benue ACReSAL validated community inventory · 2026-10"/></div>
    </div>

    <div className="grid three">
      <div className="field"><label>Default population source</label><input value={defaultPopulationSource} disabled={busy} onChange={e=>{setDefaultPopulationSource(e.target.value);resetProgress();}} placeholder="Optional; used when row source is blank"/></div>
      <div className="field"><label>Default population year</label><input inputMode="numeric" value={defaultPopulationYear} disabled={busy} onChange={e=>{setDefaultPopulationYear(e.target.value);resetProgress();}} placeholder="Optional, e.g. 2024"/></div>
      <label className="check-field settlement-verified-check"><input type="checkbox" checked={verified} disabled={busy} onChange={e=>{setVerified(e.target.checked);resetProgress();}}/> Mark imported records verified</label>
    </div>

    <div className="field"><label>File</label><input type="file" disabled={busy} accept={format==="csv"?".csv,text/csv":".geojson,.json,application/geo+json,application/json"} onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>

    <div className="actions">
      {format==="csv"&&<button className="btn" type="button" onClick={template}>Download CSV template</button>}
      <button className="btn" type="button" onClick={exportGeoJson}>Export settlement GeoJSON</button>
      <button className="btn primary" disabled={busy||!items.length||!source.trim()||cursor>=items.length} onClick={importSettlements}>{busy?"Importing batch…":cursor>0&&cursor<items.length?"Resume import":cursor===items.length&&items.length>0?"Import complete":"Validate & import settlements"}</button>
      {busy&&<button className="btn" onClick={()=>{stopAfterBatch.current=true;setPaused(true);}}>Pause after current batch</button>}
      {progress?.errors.length?<button className="btn" onClick={downloadErrors}>Download rejected rows ({progress.errors.length})</button>:null}
    </div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {items.length} records loaded for preview/import.</div>}

    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr>{format==="csv"?Object.keys(preview[0]).slice(0,8).map(k=><th key={k}>{k}</th>):<><th>#</th><th>Geometry</th><th>Properties</th></>}</tr></thead>
      <tbody>{format==="csv"
        ?preview.map((r,i)=><tr key={i}>{Object.keys(preview[0]).slice(0,8).map(k=><td key={k}>{String(r[k]??"")}</td>)}</tr>)
        :preview.map((feature,i)=><tr key={i}><td>{i+1}</td><td>{feature.geometry?.type||"Missing"}</td><td><code>{JSON.stringify(feature.properties||{}).slice(0,200)}</code></td></tr>)
      }</tbody>
    </table></div>}

    {progress&&<div className="card stack" role="status" aria-live="polite">
      <div className="section-head"><h3>Settlement import progress</h3><strong>{Math.round(progress.processed/progress.total*100)}%</strong></div>
      <progress value={progress.processed} max={progress.total} style={{width:"100%"}}/>
      <div className="muted">{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} records processed · {progress.batches} batches finished{paused?" · paused":""}</div>
      <div className="stats">
        <div className="stat"><strong>{progress.imported}</strong><span>Imported</span></div>
        <div className="stat"><strong>{progress.skipped}</strong><span>Duplicates skipped</span></div>
        <div className="stat"><strong>{progress.failed}</strong><span>Rejected (review)</span></div>
      </div>
      <div className="muted">Batches of {CHUNK_SIZE} are saved independently. Resume retries the next unconfirmed batch and skips already imported records.</div>
    </div>}
    {message&&<div className={message.startsWith("Imported")||message.includes("verified")?"success":"notice"}>{message}</div>}

    {!!imports.length&&<div className="stack">
      <div className="section-head"><h3>Recent settlement imports</h3><span className="badge">{imports.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Source</th><th>Format</th><th>Imported</th><th>Failed</th><th>Spatial LGA assignments</th><th>Verified on import</th><th>By</th></tr></thead>
        <tbody>{imports.map(job=><tr key={job.id}>
          <td>{new Date(job.created_at).toLocaleString()}</td>
          <td>{job.source}</td>
          <td>{String(job.format).toUpperCase()}</td>
          <td>{job.imported_rows}/{job.total_rows}</td>
          <td className={Number(job.failed_rows)>0?"overdue-text":""}>{job.failed_rows}</td>
          <td>{job.auto_assigned_lga_rows}</td>
          <td>{job.verified_on_import?"Yes":"No"}</td>
          <td>{job.created_by_name||"Unknown"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {!!recent.length&&<div className="stack">
      <div className="section-head"><h3>Recent settlement records</h3><span className="badge">{recent.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Settlement</th><th>LGA</th><th>Type</th><th>Population</th><th>Source</th><th>Verification</th></tr></thead>
        <tbody>{recent.slice(0,50).map(row=><tr key={row.id}>
          <td><strong>{row.name}</strong><div className="muted">{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</div></td>
          <td>{row.lga_code}</td>
          <td>{String(row.settlement_type).replaceAll("_"," ")}</td>
          <td>{row.population==null?"Unknown":Number(row.population).toLocaleString()}<div className="muted">{row.population_year||""}</div></td>
          <td>{row.source}</td>
          <td><button className={row.verified?"btn":"btn primary"} onClick={()=>toggleVerified(row)}>{row.verified?"Verified · revoke":"Verify"}</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </section>;
}
