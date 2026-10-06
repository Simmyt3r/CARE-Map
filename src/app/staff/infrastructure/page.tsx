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
        <h1>Infrastructure setup</h1>
        <div className="muted">Configure and verify Aiven, PostGIS, application secrets and administrator bootstrap from one place.</div>
      </div>
    </div>
    <InfrastructurePanel snapshot={snapshot}/>
  </div>;
}
