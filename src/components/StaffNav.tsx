"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useId,useMemo,useState} from "react";

type NavItem={href:string;label:string;short:string;admin?:boolean;exact?:boolean};
type NavGroup={title:string;items:NavItem[]};
const groups:NavGroup[]=[
  {title:"Overview",items:[
    {href:"/staff",label:"Dashboard",short:"DB",exact:true},
    {href:"/staff/operations",label:"Operations center",short:"OP"},
    {href:"/staff/reports",label:"Community reports",short:"RP"}
  ]},
  {title:"Community programs",items:[
    {href:"/staff/extension",label:"Extension & communities",short:"EX"},
    {href:"/staff/field-acceptance",label:"Field acceptance",short:"FA"}
  ]},
  {title:"GIS & environment",items:[
    {href:"/staff/data",label:"Field assets",short:"AS"},
    {href:"/staff/gis",label:"GIS workbench",short:"GIS"},
    {href:"/staff/analysis",label:"Spatial analysis",short:"AN"},
    {href:"/staff/map-composer",label:"Map composer",short:"MP"},
    {href:"/staff/remote-sensing",label:"Sentinel-2 analysis",short:"S2",exact:true},
    {href:"/staff/remote-sensing/monitoring",label:"Vegetation monitoring",short:"VM"}
  ]},
  {title:"Administration",items:[
    {href:"/staff/admin",label:"User accounts",short:"US",admin:true,exact:true},
    {href:"/staff/admin/governance",label:"Governance",short:"GV",admin:true},
    {href:"/staff/admin/privacy",label:"Data privacy",short:"PR",admin:true},
    {href:"/staff/admin/localization",label:"Localization",short:"LN",admin:true},
    {href:"/staff/infrastructure",label:"Infrastructure",short:"IT",admin:true}
  ]}
];
const allItems=groups.flatMap(group=>group.items);
function active(href:string,exact:boolean|undefined,path:string){
  return exact?path===href:path===href||path.startsWith(href+"/");
}

export default function StaffNav({role,name}:{role:string;name:string}){
  const pathname=usePathname();
  const router=useRouter();
  const navId=useId();
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState("");
  const[loggingOut,setLoggingOut]=useState(false);
  const filtered=useMemo(()=>groups.map(group=>({
    ...group,items:group.items.filter(item=>(role==="admin"||!item.admin)&&
      item.label.toLowerCase().includes(search.trim().toLowerCase()))
  })).filter(group=>group.items.length),[role,search]);
  const current=allItems.filter(item=>(role==="admin"||!item.admin)&&active(item.href,item.exact,pathname))
    .sort((a,b)=>b.href.length-a.href.length)[0];
  useEffect(()=>{setOpen(false);setSearch("");},[pathname]);
  useEffect(()=>{
    if(!open)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("keydown",escape);
    return ()=>document.removeEventListener("keydown",escape);
  },[open]);

  async function logout(){
    setLoggingOut(true);
    try{
      const response=await fetch("/api/auth/logout",{method:"POST"});
      if(!response.ok)throw Error("Sign-out request failed");
      router.replace("/login");
      router.refresh();
    }catch{
      setLoggingOut(false);
      alert("Sign-out failed. Check your network and try again.");
    }
  }

  return <>
    <div className="staff-mobile-bar no-print">
      <button type="button" className="staff-menu-toggle" aria-expanded={open}
        aria-controls={navId} aria-label={open?"Close staff navigation":"Open staff navigation"}
        onClick={()=>setOpen(v=>!v)}>
        <span aria-hidden="true">{open?"×":"☰"}</span>
        <span>Menu</span>
      </button>
      <div className="staff-mobile-current"><small>WORKSPACE</small><strong>{current?.label||"Dashboard"}</strong></div>
      <Link href="/staff" className="staff-mobile-home" aria-label="Go to staff dashboard">CM</Link>
    </div>
    {open&&<button type="button" className="staff-nav-overlay no-print" onClick={()=>setOpen(false)}
      aria-label="Close navigation overlay"/>}
    <aside className={"staff-sidebar no-print"+(open?" staff-sidebar-open":"")} id={navId}
      aria-label="Staff workspace navigation">
      <div className="staff-sidebar-brand">
        <div className="staff-sidebar-monogram" aria-hidden="true">CM</div>
        <div><strong>CARE-Map</strong><small>Benue ACReSAL Workspace</small></div>
        <button className="staff-sidebar-close" type="button" onClick={()=>setOpen(false)}
          aria-label="Close navigation">×</button>
      </div>
      <label className="staff-nav-search-label" htmlFor="staff-nav-search">Find a workspace page</label>
      <input id="staff-nav-search" className="staff-nav-search" type="search"
        value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search tools…" autoComplete="off"/>
      <nav className="staff-sidebar-links" aria-label="Staff tools">
        {filtered.length?filtered.map(group=><div key={group.title} className="staff-nav-group">
          <span className="staff-nav-group-title">{group.title}</span>
          {group.items.map(item=><Link key={item.href} href={item.href} prefetch={false}
            className={"staff-nav-link"+(active(item.href,item.exact,pathname)?" is-active":"")}
            aria-current={active(item.href,item.exact,pathname)?"page":undefined}
            onClick={()=>setOpen(false)}>
            <span className="staff-nav-symbol" aria-hidden="true">{item.short}</span>
            <span>{item.label}</span>
          </Link>)}
        </div>):<p className="staff-nav-empty">No tools match that search.</p>}
      </nav>
      <div className="staff-sidebar-footer">
        <a className="staff-nav-export" href="/api/dashboard/export">Download operations CSV <span aria-hidden="true">↗</span></a>
        <div className="staff-profile">
          <div className="staff-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()||"S"}</div>
          <div className="staff-profile-info"><strong title={name}>{name}</strong><small>{role==="admin"?"Administrator":"Field / GIS staff"}</small></div>
          <button className="staff-signout" onClick={logout} type="button"
            disabled={loggingOut} title="Sign out" aria-label="Sign out">
            {loggingOut?"…":"↪"}
          </button>
        </div>
      </div>
    </aside>
  </>;
}
