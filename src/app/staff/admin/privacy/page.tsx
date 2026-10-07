import {redirect} from "next/navigation";
import {getSession,isAdmin} from "@/lib/auth";
import PrivacyGovernanceCenter from "@/components/PrivacyGovernanceCenter";

export const dynamic="force-dynamic";

export default async function PrivacyGovernancePage(){
  const session=await getSession();
  if(!isAdmin(session))redirect("/staff");
  return <PrivacyGovernanceCenter/>;
}
