import {redirect} from "next/navigation";
import {getSession,isStaff} from "@/lib/auth";
import StaffNav from "@/components/StaffNav";
export const dynamic="force-dynamic";
export default async function StaffLayout({children}:{children:React.ReactNode}){
  const session=await getSession();
  if(!isStaff(session))redirect("/login");
  return <div className="staff-workspace">
    <StaffNav role={session.role} name={session.name}/>
    <div className="staff-workspace-main" id="staff-content">{children}</div>
  </div>;
}