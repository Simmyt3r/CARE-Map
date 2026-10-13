"use client";

import {useEffect} from "react";

export default function StaffError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("CARE-Map workspace error",error);},[error]);
  return <section className="card stack" role="alert" style={{maxWidth:680,margin:"18px auto",padding:25}}>
    <span className="page-eyebrow">Workspace temporarily unavailable</span>
    <h1 style={{margin:0}}>This page could not load</h1>
    <p className="muted">Your records have not been changed by this error. It may be a temporary database or network connection problem. Try once more. If it persists, contact your CARE-Map administrator.</p>
    <div className="actions">
      <button className="btn primary" onClick={reset}>Try loading again</button>
      <a className="btn" href="/staff">Back to dashboard</a>
    </div>
    {error.digest&&<small className="muted">Reference: {error.digest}</small>}
  </section>;
}
