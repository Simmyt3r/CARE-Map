"use client";
import {useCallback,useMemo,useState,useEffect} from "react";

type ImportFormat="csv"|"geojson";

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

  const load=useCallback(async()=>{
    const r=await fetch("/api/gis/settlements");
    const j=await r.json().catch(()=>({}));
    if(r.ok){setSummary(j.summary||null);setRecent(j.data||[]);setImports(j.imports||[]);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const items=format==="csv"?rows:features;
  const preview=useMemo(()=>items.slice(0,8),[items]);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
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
    if(!items.length||!source.trim())return;
    setBusy(true);setMessage("");
    const payload={
      source:source.trim(),
      format,
      verified,
      defaultPopulationSource:defaultPopulationSource.trim()||null,
      defaultPopulationYear:defaultPopulationYear.trim()||null,
      ...(format==="csv"?{rows}:{features})
    };
    const r=await fetch("/api/gis/settlements/import",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Settlement import failed.");
    const d=j.data;
    setMessage(
      "Imported "+d.imported+" of "+d.total+" settlements. "+
      d.failed+" failed. "+d.autoAssignedLga+" LGAs were assigned spatially."
    );
    await load();
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
      <div className="field"><label>Import format</label><select value={format} onChange={e=>{setFormat(e.target.value as ImportFormat);setRows([]);setFeatures([]);setFileName("");}}>
        <option value="csv">CSV coordinates</option>
        <option value="geojson">GeoJSON points</option>
      </select></div>
      <div className="field"><label>Dataset source / provenance</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Benue ACReSAL validated community inventory · 2026-10"/></div>
    </div>

    <div className="grid three">
      <div className="field"><label>Default population source</label><input value={defaultPopulationSource} onChange={e=>setDefaultPopulationSource(e.target.value)} placeholder="Optional; used when row source is blank"/></div>
      <div className="field"><label>Default population year</label><input inputMode="numeric" value={defaultPopulationYear} onChange={e=>setDefaultPopulationYear(e.target.value)} placeholder="Optional, e.g. 2024"/></div>
      <label className="check-field settlement-verified-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Mark imported records verified</label>
    </div>

    <div className="field"><label>File</label><input type="file" accept={format==="csv"?".csv,text/csv":".geojson,.json,application/geo+json,application/json"} onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>

    <div className="actions">
      {format==="csv"&&<button className="btn" type="button" onClick={template}>Download CSV template</button>}
      <button className="btn" type="button" onClick={exportGeoJson}>Export settlement GeoJSON</button>
      <button className="btn primary" disabled={busy||!items.length||!source.trim()} onClick={importSettlements}>{busy?"Importing…":"Validate & import settlements"}</button>
    </div>

    {fileName&&<div className="notice"><strong>{fileName}</strong> · {items.length} records loaded for preview/import.</div>}

    {!!preview.length&&<div className="table-wrap"><table>
      <thead><tr>{format==="csv"?Object.keys(preview[0]).slice(0,8).map(k=><th key={k}>{k}</th>):<><th>#</th><th>Geometry</th><th>Properties</th></>}</tr></thead>
      <tbody>{format==="csv"
        ?preview.map((r,i)=><tr key={i}>{Object.keys(preview[0]).slice(0,8).map(k=><td key={k}>{String(r[k]??"")}</td>)}</tr>)
        :preview.map((feature,i)=><tr key={i}><td>{i+1}</td><td>{feature.geometry?.type||"Missing"}</td><td><code>{JSON.stringify(feature.properties||{}).slice(0,200)}</code></td></tr>)
      }</tbody>
    </table></div>}

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
