"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useId,useState} from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {useI18n} from "@/components/LocalizationProvider";
import {deploymentProfile} from "@/lib/deployment-profile";

export default function AppNav(){
  const {t}=useI18n();
  const path=usePathname();
  const navId=useId();
  const[open,setOpen]=useState(false);
  useEffect(()=>setOpen(false),[path]);
  useEffect(()=>{
    if(!open)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("keydown",close);
    return ()=>document.removeEventListener("keydown",close);
  },[open]);
  const links=[
    {href:"/",label:t("nav.publicMap"),exact:true},
    {href:"/extension",label:"Community extension"},
    {href:"/report",label:t("nav.reportIssue")},
    {href:"/privacy",label:t("nav.privacy")},
    {href:"/register",label:t("nav.register")}
  ];
  return <header className="topbar no-print">
    <div className="shell topbar-inner">
      <Link className="brand brand-mark" href="/" aria-label="CARE-Map public homepage">
        <span className="brand-emblem" aria-hidden="true">CM</span>
        <span><strong>CARE-Map</strong><small>{deploymentProfile.stateName} ACReSAL</small></span>
      </Link>
      <button type="button" className="public-menu-toggle" aria-controls={navId}
        aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
        <span aria-hidden="true">{open?"×":"☰"}</span><span>{open?"Close":"Menu"}</span>
      </button>
      <nav id={navId} className={"nav public-nav"+(open?" public-nav-open":"")} aria-label="Main navigation">
        {links.map(item=><Link key={item.href} href={item.href}
          aria-current={(item.exact?path===item.href:path.startsWith(item.href))?"page":undefined}
          onClick={()=>setOpen(false)}>{item.label}</Link>)}
        <Link className="nav-login" href="/login" onClick={()=>setOpen(false)}>{t("nav.staffLogin")}</Link>
        <LanguageSwitcher/>
      </nav>
    </div>
  </header>;
}
