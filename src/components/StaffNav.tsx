"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";

export default function StaffNav({role,name}:{role:string;name:string}){
  const router=useRouter();
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login");}
  return <div className="card" style={{marginBottom:18}}>
    <div className="section-head"><div><strong>{name}</strong><div className="muted">{role}</div></div><button className="btn" onClick={logout}>Sign out</button></div>
    <div className="staff-tabs">
      <Link href="/staff">Dashboard</Link>
      <Link href="/staff/data">GIS Data</Link>\n      <Link href="/staff/gis">GIS Workbench</Link>
      <Link href="/staff/reports">Reports</Link>
      {role==="admin"&&<Link href="/staff/admin">Users</Link>}
      {role==="admin"&&<Link href="/staff/infrastructure">Infrastructure</Link>}
      <a href="/api/dashboard/export">Export CSV</a>
    </div>
  </div>;
}
