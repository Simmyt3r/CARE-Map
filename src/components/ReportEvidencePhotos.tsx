/* eslint-disable @next/next/no-img-element */
"use client";
import {useCallback,useEffect,useRef,useState} from "react";

export default function ReportEvidencePhotos({reportId}:{reportId:string}){
  const[photos,setPhotos]=useState<any[]>([]);
  const[caption,setCaption]=useState("");
  const[file,setFile]=useState<File|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  const inputRef=useRef<HTMLInputElement|null>(null);

  const load=useCallback(async()=>{
    const r=await fetch("/api/reports/"+reportId+"/photos");
    const j=await r.json().catch(()=>({}));
    if(r.ok)setPhotos(j.data||[]);
  },[reportId]);

  useEffect(()=>{void load();},[load]);

  async function upload(e:React.FormEvent){
    e.preventDefault();
    if(!file)return setMessage("Choose an evidence photo first.");
    setBusy(true);setMessage("");
    const form=new FormData();
    form.set("file",file);
    form.set("caption",caption);
    const r=await fetch("/api/reports/"+reportId+"/photos",{method:"POST",body:form});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Evidence photo upload failed.");
    setFile(null);setCaption("");if(inputRef.current)inputRef.current.value="";
    setMessage("Evidence photo added.");await load();
  }

  return <section className="drawer-section stack">
    <div className="section-head"><div><h3>Field evidence</h3><div className="muted">Attach field photos before closing a verification task.</div></div><span className="badge">{photos.length}</span></div>
    <form className="stack" onSubmit={upload}>
      <div className="field"><label>Photo</label><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
      <div className="field"><label>Caption / observation</label><input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="What does this photo show?"/></div>
      <button className="btn" disabled={busy||!file}>{busy?"Uploading…":"Add evidence photo"}</button>
    </form>
    {message&&<div className={message.includes("failed")||message.includes("configured")?"error":"notice"}>{message}</div>}
    {photos.length>0&&<div className="evidence-grid">
      {photos.map(p=><figure key={p.id}>
        <img src={p.url} alt={p.caption||"Field evidence"}/>
        <figcaption><strong>{p.caption||"Field evidence"}</strong><small>{new Date(p.uploaded_at).toLocaleString()} · {p.uploaded_by_name||"Staff"}</small></figcaption>
      </figure>)}
    </div>}
  </section>;
}
