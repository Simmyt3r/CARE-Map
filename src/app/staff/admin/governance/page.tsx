import {redirect} from "next/navigation";
import {getSession,isAdmin} from "@/lib/auth";
import AdminGovernance from "@/components/AdminGovernance";

export const dynamic="force-dynamic";

export default async function GovernancePage(){
  const session=await getSession();
  if(!isAdmin(session))redirect("/staff");
  return <div className="stack">
    <div className="section-head"><div><h1>Governance & Audit</h1><div className="muted">Administrative accountability for data changes and bulk imports.</div></div></div>
    <AdminGovernance/>
  </div>;
}
