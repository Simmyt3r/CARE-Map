"use client";
import {useEffect,useRef,useState} from "react";

export default function ServiceWorkerRegister(){
  const[online,setOnline]=useState(true);
  const[waiting,setWaiting]=useState<ServiceWorker|null>(null);
  const reloadForUpdate=useRef(false);

  useEffect(()=>{
    setOnline(navigator.onLine);

    const handleOnline=()=>setOnline(true);
    const handleOffline=()=>setOnline(false);
    window.addEventListener("online",handleOnline);
    window.addEventListener("offline",handleOffline);

    if(!("serviceWorker" in navigator)){
      return()=>{
        window.removeEventListener("online",handleOnline);
        window.removeEventListener("offline",handleOffline);
      };
    }

    const handleControllerChange=()=>{
      if(!reloadForUpdate.current)return;
      reloadForUpdate.current=false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange",handleControllerChange);

    let registration:ServiceWorkerRegistration|null=null;
    let stateWorker:ServiceWorker|null=null;
    const handleStateChange=()=>{
      if(stateWorker?.state==="installed"&&navigator.serviceWorker.controller){
        setWaiting(registration?.waiting||stateWorker);
      }
    };

    void navigator.serviceWorker.register("/sw.js",{scope:"/"}).then(r=>{
      registration=r;
      if(r.waiting)setWaiting(r.waiting);

      const handleUpdateFound=()=>{
        stateWorker=r.installing;
        stateWorker?.addEventListener("statechange",handleStateChange);
      };
      r.addEventListener("updatefound",handleUpdateFound);

      return()=>{
        r.removeEventListener("updatefound",handleUpdateFound);
      };
    }).catch(()=>{});

    return()=>{
      window.removeEventListener("online",handleOnline);
      window.removeEventListener("offline",handleOffline);
      navigator.serviceWorker.removeEventListener("controllerchange",handleControllerChange);
      stateWorker?.removeEventListener("statechange",handleStateChange);
    };
  },[]);

  function installUpdate(){
    if(!waiting)return;
    reloadForUpdate.current=true;
    waiting.postMessage({type:"SKIP_WAITING"});
  }

  if(online&&!waiting)return null;

  return <div className={"connectivity-banner "+(!online?"offline":"update")} role="status" aria-live="polite">
    {!online
      ?<span><strong>Offline.</strong> Live maps and server actions may be unavailable. Reports queued from the public report page remain on this device until connection returns.</span>
      :<span><strong>CARE-Map update ready.</strong> Apply it when you are not in the middle of a field form.</span>}
    {waiting&&<button type="button" onClick={installUpdate}>Apply update</button>}
  </div>;
}
