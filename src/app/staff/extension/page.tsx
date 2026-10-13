import ExtensionCenter from "@/components/ExtensionCenter";
import {getSession,isAdmin} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function ExtensionStaffPage(){
  const user=await getSession();
  return <div className="stack">
    <div className="section-head"><div><h1>ACReSAL Extension & Communities</h1>
      <p className="muted">Community focal persons, project aftercare, extension visits and merit-based stewardship review.</p></div></div>
    <ExtensionCenter admin={isAdmin(user)}/>
  </div>;
}