"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {
  englishCatalog,
  targetLanguages,
  validateTranslationMap
} from "@/lib/i18n";

function downloadJson(filename:string,data:unknown){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),500);
}

export default function LocalizationAdminCenter(){
  const[packs,setPacks]=useState<any[]>([]);
  const[imports,setImports]=useState<any[]>([]);
  const[languageCode,setLanguageCode]=useState("tiv");
  const[source,setSource]=useState("");
  const[version,setVersion]=useState("1");
  const[fileName,setFileName]=useState("");
  const[translations,setTranslations]=useState<Record<string,unknown>>({});
  const[message,setMessage]=useState("");
  const[notReady,setNotReady]=useState(false);
  const[busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const r=await fetch("/api/admin/i18n/packs");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Could not load translation packs.");
    setPacks(j.data||[]);
    setImports(j.imports||[]);
    setNotReady(Boolean(j.notReady));
  },[]);

  useEffect(()=>{void load();},[load]);

  const preview=useMemo(()=>validateTranslationMap(translations),[translations]);
  const target=targetLanguages.find(x=>x.code===languageCode);

  async function readFile(file:File){
    setMessage("");setFileName(file.name);
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      const map=data?.translations&&typeof data.translations==="object"?data.translations:data;
      const checked=validateTranslationMap(map);
      if(!Object.keys(checked.translations).length)throw new Error("File contains no recognized CARE-Map translation keys.");
      setTranslations(map as Record<string,unknown>);
    }catch(e){
      setTranslations({});
      setMessage(e instanceof Error?e.message:"Could not read translation JSON.");
    }
  }

  async function importPack(){
    if(!source.trim()||!version.trim()||!Object.keys(translations).length)return;
    setBusy(true);setMessage("");
    const r=await fetch("/api/admin/i18n/packs",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({languageCode,source:source.trim(),version:version.trim(),translations})
    });
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Translation import failed.");
    setMessage(
      "Imported "+languageCode+" as draft. Coverage: "+Number(j.data.coverage).toFixed(1)+
      "%. Missing "+j.data.missingKeys.length+" required key(s)."
    );
    await load();
  }

  async function action(code:string,action:string){
    setMessage("");
    const r=await fetch("/api/admin/i18n/packs/"+encodeURIComponent(code),{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Translation-pack update failed.");
    setMessage("Translation pack "+action+" completed.");
    await load();
  }

  function template(){
    downloadJson("care-map-translation-template-en.json",{
      languageCode:"replace-with-language-code",
      source:"Human translator / reviewer and organization",
      version:"1",
      translations:englishCatalog
    });
  }

  return <div className="stack">
    <section className="card stack">
      <div className="section-head">
        <div><h1>Localization & translation review</h1><div className="muted">Manage human-reviewed public translation packs. English is the permanent safe fallback.</div></div>
        <div className="actions compact-actions"><button className="btn" onClick={template}>Download English template</button><button className="btn" onClick={load}>Refresh</button></div>
      </div>
      <div className="notice"><strong>Review rule:</strong> CARE-Map will never publish a draft pack. A pack must contain every required public key, be explicitly reviewed by an administrator, and then be separately enabled.</div>
      {notReady&&<div className="error"><strong>Migration 015 is not applied.</strong> Apply <code>015_localization.sql</code> before importing or reviewing translation packs.</div>}
      <div className="stats localization-stats">
        <div className="stat"><strong>{packs.length}</strong><span>Target language packs</span></div>
        <div className="stat"><strong>{packs.filter(p=>p.status==="reviewed").length}</strong><span>Reviewed</span></div>
        <div className="stat"><strong>{packs.filter(p=>p.enabled).length}</strong><span>Publicly enabled</span></div>
        <div className="stat"><strong>{packs.filter(p=>Number(p.coverage)===100).length}</strong><span>100% key coverage</span></div>
      </div>
      {message&&<div className={message.includes("completed")||message.startsWith("Imported")?"success":"notice"}>{message}</div>}
    </section>

    <section className="card stack">
      <div><h2>Import a translation pack</h2><div className="muted">Use the English template, translate the values only, then have a fluent human reviewer verify wording in context before approval.</div></div>
      <div className="grid three">
        <div className="field"><label>Language</label><select value={languageCode} onChange={e=>{setLanguageCode(e.target.value);setTranslations({});setFileName("");}}>
          {targetLanguages.filter(x=>x.code!=="en").map(lang=><option key={lang.code} value={lang.code}>{lang.name}</option>)}
        </select></div>
        <div className="field"><label>Pack version</label><input value={version} onChange={e=>setVersion(e.target.value)} placeholder="1"/></div>
        <div className="field"><label>Human translation / review source</label><input value={source} onChange={e=>setSource(e.target.value)} placeholder="Translator/reviewer name, team or organization"/></div>
      </div>
      <div className="field"><label>Translation JSON</label><input type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/></div>

      {fileName&&<div className="translation-preview">
        <div><strong>{fileName}</strong><span>{target?.name} · {preview.translated}/{preview.required} keys · {preview.coverage.toFixed(1)}%</span></div>
        <div className="translation-meter"><span style={{width:preview.coverage+"%"}}/></div>
        <div className="grid two">
          <div><strong>Missing required keys</strong><div className="translation-key-list">{preview.missing.length?preview.missing.map(k=><code key={k}>{k}</code>):<span className="success-inline">None</span>}</div></div>
          <div><strong>Unknown ignored keys</strong><div className="translation-key-list">{preview.unknown.length?preview.unknown.map(k=><code key={k}>{k}</code>):<span className="muted">None</span>}</div></div>
        </div>
        <details className="translation-compare">
          <summary>Review English vs translated strings</summary>
          <div className="table-wrap"><table>
            <thead><tr><th>Key</th><th>English</th><th>{target?.name||"Translation"}</th></tr></thead>
            <tbody>{Object.keys(englishCatalog).map(key=><tr key={key}>
              <td><code>{key}</code></td>
              <td>{englishCatalog[key as keyof typeof englishCatalog]}</td>
              <td>{String(preview.translations[key]||"")||<span className="muted">Missing</span>}</td>
            </tr>)}</tbody>
          </table></div>
        </details>
      </div>}

      <button className="btn primary" disabled={notReady||busy||!source.trim()||!version.trim()||!Object.keys(translations).length} onClick={importPack}>{busy?"Importing…":"Import as draft"}</button>
    </section>

    <section className="card stack">
      <div className="section-head"><div><h2>Translation packs</h2><div className="muted">Editing/importing a reviewed pack automatically returns it to draft and disables it until reviewed again.</div></div><span className="badge">{packs.length}</span></div>
      <div className="translation-pack-grid">
        {packs.map(pack=><article className="translation-pack-card" key={pack.language_code}>
          <div className="section-head">
            <div><h3>{pack.language_name}</h3><div className="muted">{pack.native_name} · {pack.language_code}</div></div>
            <div className="stack compact-stack">{pack.enabled?<span className="badge">Public</span>:<span className="badge">Not public</span>}<span className={"translation-status "+pack.status}>{pack.status}</span></div>
          </div>
          <div className="translation-meter"><span style={{width:Number(pack.coverage||0)+"%"}}/></div>
          <div className="resource-facts">
            <div><span>Coverage</span><strong>{Number(pack.coverage||0).toFixed(1)}%</strong></div>
            <div><span>Keys</span><strong>{pack.translatedKeys}/{pack.requiredKeys}</strong></div>
            <div><span>Version</span><strong>{pack.version||"—"}</strong></div>
            <div><span>Source</span><strong>{pack.source||"—"}</strong></div>
            <div><span>Reviewed by</span><strong>{pack.reviewed_by_name||"—"}</strong></div>
          </div>
          {!!pack.missingKeys?.length&&<details><summary>Missing {pack.missingKeys.length} key(s)</summary><div className="translation-key-list">{pack.missingKeys.map((k:string)=><code key={k}>{k}</code>)}</div></details>}
          <details className="translation-compare">
            <summary>Review strings</summary>
            <div className="table-wrap"><table>
              <thead><tr><th>Key</th><th>English</th><th>{pack.language_name}</th></tr></thead>
              <tbody>{Object.keys(englishCatalog).map(key=><tr key={key}>
                <td><code>{key}</code></td>
                <td>{englishCatalog[key as keyof typeof englishCatalog]}</td>
                <td>{String(pack.translations?.[key]||"")||<span className="muted">Missing</span>}</td>
              </tr>)}</tbody>
            </table></div>
          </details>
          <div className="actions">
            {pack.status!=="reviewed"&&<button className="btn primary" disabled={Number(pack.coverage)!==100} onClick={()=>action(pack.language_code,"review")}>Approve review</button>}
            {pack.status==="reviewed"&&!pack.enabled&&<button className="btn primary" onClick={()=>action(pack.language_code,"enable")}>Enable publicly</button>}
            {pack.enabled&&<button className="btn" onClick={()=>action(pack.language_code,"disable")}>Disable</button>}
            {pack.status==="reviewed"&&<button className="btn" onClick={()=>action(pack.language_code,"revoke")}>Revoke review</button>}
          </div>
        </article>)}
      </div>
    </section>

    {!!imports.length&&<section className="card stack">
      <div className="section-head"><h2>Recent imports</h2><span className="badge">{imports.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Language</th><th>Version</th><th>Coverage</th><th>Missing</th><th>Unknown</th><th>Imported by</th></tr></thead>
        <tbody>{imports.map(row=><tr key={row.id}>
          <td>{new Date(row.created_at).toLocaleString()}</td><td>{row.language_code}</td><td>{row.version||"—"}</td>
          <td>{Number(row.coverage_pct).toFixed(1)}%</td><td>{Array.isArray(row.missing_keys)?row.missing_keys.length:"—"}</td><td>{Array.isArray(row.unknown_keys)?row.unknown_keys.length:"—"}</td><td>{row.created_by_name||"Unknown"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
  </div>;
}
