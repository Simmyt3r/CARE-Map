import {redirect} from "next/navigation";
import {getSession,isAdmin} from "@/lib/auth";
import LocalizationAdminCenter from "@/components/LocalizationAdminCenter";

export const dynamic="force-dynamic";

export default async function LocalizationAdminPage(){
  const session=await getSession();
  if(!isAdmin(session))redirect("/staff");
  return <LocalizationAdminCenter/>;
}
