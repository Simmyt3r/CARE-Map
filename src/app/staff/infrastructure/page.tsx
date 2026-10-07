import {redirect} from "next/navigation";
import {getSession,isAdmin} from "@/lib/auth";
import {currentInfrastructureSnapshot} from "@/lib/infrastructure";
import InfrastructurePanel from "@/components/InfrastructurePanel";

export const dynamic="force-dynamic";

export default async function InfrastructurePage(){
  const session=await getSession();
  if(!isAdmin(session))redirect("/staff");
  const snapshot=await currentInfrastructureSnapshot();
  return <div className="stack">
    <div className="section-head">
      <div>
        <h1>Production readiness & infrastructure</h1>
        <div className="muted">Verify launch gates, configure Aiven/PostGIS, manage secrets, and see exactly what still blocks production.</div>
      </div>
    </div>
    <InfrastructurePanel snapshot={snapshot}/>
  </div>;
}
