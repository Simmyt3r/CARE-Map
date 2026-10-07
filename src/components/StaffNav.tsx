"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";

export default function StaffNav({role,name}:{role:string;name:string}){
  const router=useRouter();

  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    router.push("/login");
  }

  return <div className="card staff-nav-card" style={{marginBottom:18}}>
    <div className="section-head">
      <div><strong>{name}</strong><div className="muted">{role}</div></div>
      <button className="btn" onClick={logout}>Sign out</button>
    </div>
    <div className="staff-tabs">
      <Link href="/staff">Dashboard</Link>
      <Link href="/staff/operations">Operations</Link>
      <Link href="/staff/data">GIS Data</Link>
      <Link href="/staff/gis">GIS Workbench</Link>
      <Link href="/staff/analysis">Spatial Analysis</Link>
      <Link href="/staff/map-composer">Map Composer</Link>
      <Link href="/staff/remote-sensing">Remote Sensing</Link>
      <Link href="/staff/remote-sensing/monitoring">Monitoring</Link>
      <Link href="/staff/reports">Reports</Link>
      <Link href="/staff/field-acceptance">Field Acceptance</Link>
      {role==="admin"&&<Link href="/staff/admin">Users</Link>}
      {role==="admin"&&<Link href="/staff/admin/governance">Governance</Link>}
      {role==="admin"&&<Link href="/staff/admin/privacy">Privacy</Link>}
      {role==="admin"&&<Link href="/staff/infrastructure">Infrastructure</Link>}
      <a href="/api/dashboard/export">Export CSV</a>
    </div>
  </div>;
}
