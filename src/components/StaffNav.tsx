"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useId,useMemo,useState} from "react";
import {WORKSPACES,canAccessWorkspace,type WorkspaceId} from "@/lib/workspaces";

type NavItem={href:string;label:string;short:string;exact?:boolean};
type NavGroup={title:string;items:NavItem[]};
const adminTools:NavItem[]=[
 {href:"/staff/admin",label:"Users & access",short:"US",exact:true},
 {href:"/staff/admin/migrations",label:"Database migrations",short:"DB"},
 {href:"/staff/admin/governance",label:"Governance & audit",short:"GV"},
 {href:"/staff/admin/privacy",label:"Data privacy",short:"PR"},
 {href:"/staff/admin/localization",label:"Localization",short:"LN"},
 {href:"/staff/infrastructure",label:"Infrastructure",short:"IT"}
];
function active(href:string,exact:boolean|undefined,path:string){
 return exact?path===href:path===href||path.startsWith(href+"/");
}

export default function StaffNav({role,name,access}:{
 role:string;name:string;access:WorkspaceId[];
}){
 const pathname=usePathname();
 const router=useRouter();
 const navId=useId();
 const[open,setOpen]=useState(false);
 const[search,setSearch]=useState("");
 const[expanded,setExpanded]=useState<string[]>(["Overview"]);
 const[loggingOut,setLoggingOut]=useState(false);

 const groups=useMemo(()=>{
  const result:NavGroup[]=[{
   title:"Overview",items:[{href:"/staff",label:"My dashboard",short:"DB",exact:true}]
  }];
  for(const workspace of WORKSPACES){
   if(!canAccessWorkspace(role,access,workspace.id))continue;
   let group=result.find(x=>x.title===workspace.group);
   if(!group){group={title:workspace.group,items:[]};result.push(group);}
   group.items.push({
    href:workspace.href,label:workspace.title,short:workspace.short,
    exact:workspace.id==="satellite"
   });
  }
  if(role==="admin")result.push({title:"Administration",items:adminTools});
  return result;
 },[role,access]);
 const allItems=groups.flatMap(group=>group.items);
 const current=allItems.filter(item=>active(item.href,item.exact,pathname))
   .sort((a,b)=>b.href.length-a.href.length)[0];
 const normalized=search.trim().toLowerCase();
 const filtered=groups.map(group=>({
  ...group,items:group.items.filter(item=>item.label.toLowerCase().includes(normalized))
 })).filter(group=>group.items.length);
 const canExport=role==="admin"||access.some(x=>["field","gis","maps"].includes(x));

 useEffect(()=>{setOpen(false);setSearch("");},[pathname]);
 useEffect(()=>{
  if(!open)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
  document.addEventListener("keydown",escape);
  return()=>document.removeEventListener("keydown",escape);
 },[open]);
 async function logout(){
  setLoggingOut(true);
  try{
   const response=await fetch("/api/auth/logout",{method:"POST"});
   if(!response.ok)throw Error("Sign-out request failed");
   router.replace("/login");router.refresh();
  }catch{
   setLoggingOut(false);
   alert("Sign-out failed. Check your network and try again.");
  }
 }
 const toggle=(group:string)=>setExpanded(current=>
   current.includes(group)?current.filter(x=>x!==group):[...current,group]
 );
 return <>
  <div className="staff-mobile-bar no-print">
   <button type="button" className="staff-menu-toggle" aria-expanded={open}
     aria-controls={navId} aria-label={open?"Close staff navigation":"Open staff navigation"}
     onClick={()=>setOpen(x=>!x)}>
    <span aria-hidden="true">{open?"×":"☰"}</span><span>Menu</span>
   </button>
   <div className="staff-mobile-current"><small>WORKSPACE</small><strong>{current?.label||"My dashboard"}</strong></div>
   <Link href="/staff" className="staff-mobile-home" aria-label="Go to your dashboard">CM</Link>
  </div>
  {open&&<button type="button" className="staff-nav-overlay no-print"
    onClick={()=>setOpen(false)} aria-label="Close navigation overlay"/>}
  <aside className={"staff-sidebar no-print"+(open?" staff-sidebar-open":"")}
    id={navId} aria-label="Staff workspace navigation">
   <div className="staff-sidebar-brand">
    <div className="staff-sidebar-monogram" aria-hidden="true">CM</div>
    <div><strong>CARE-Map</strong><small>{role==="admin"?"All workspaces":"My assigned workspaces"}</small></div>
    <button className="staff-sidebar-close" type="button" onClick={()=>setOpen(false)}
     aria-label="Close navigation">×</button>
   </div>
   <label className="staff-nav-search-label" htmlFor="staff-nav-search">Find my tools</label>
   <input id="staff-nav-search" className="staff-nav-search" type="search"
    value={search} onChange={event=>setSearch(event.target.value)}
    placeholder="Search assigned tools…" autoComplete="off"/>
   <nav className="staff-sidebar-links" aria-label="Workspace tools">
    {filtered.map(group=>{
     const isActive=group.items.some(item=>active(item.href,item.exact,pathname));
     const show=!!normalized||isActive||expanded.includes(group.title);
     return <div key={group.title} className="staff-nav-group">
      <button type="button" className="staff-nav-group-toggle"
       aria-expanded={show} onClick={()=>toggle(group.title)}>
       <span>{group.title}</span><span aria-hidden="true">{show?"−":"+"}</span>
      </button>
      {show&&group.items.map(item=><Link key={item.href} href={item.href}
       prefetch={false} className={"staff-nav-link"+(active(item.href,item.exact,pathname)?" is-active":"")}
       aria-current={active(item.href,item.exact,pathname)?"page":undefined}
       onClick={()=>setOpen(false)}>
       <span className="staff-nav-symbol" aria-hidden="true">{item.short}</span>
       <span>{item.label}</span>
      </Link>)}
     </div>;
    })}
    {!filtered.length&&<p className="staff-nav-empty">No assigned tools match your search.</p>}
   </nav>
   <div className="staff-sidebar-footer">
    {canExport&&<a className="staff-nav-export" href="/api/dashboard/export">
     Download asset CSV <span aria-hidden="true">↗</span></a>}
    <div className="staff-profile">
     <div className="staff-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()||"S"}</div>
     <div className="staff-profile-info"><strong title={name}>{name}</strong>
      <small>{role==="admin"?"Administrator · Full access":access.length+" assigned interface(s)"}</small>
     </div>
     <button className="staff-signout" onClick={logout} type="button"
      disabled={loggingOut} title="Sign out" aria-label="Sign out">
      {loggingOut?"…":"↪"}
     </button>
    </div>
   </div>
  </aside>
 </>;
}
