import {redirect} from "next/navigation";
import {getSession,isStaff} from "@/lib/auth";
import {loadWorkspaceAccess} from "@/lib/workspace-access";
import StaffNav from "@/components/StaffNav";
export const dynamic="force-dynamic";
export default async function StaffLayout({children}:{children:React.ReactNode}){
 const session=await getSession();
 if(!isStaff(session))redirect("/login");
 const access=await loadWorkspaceAccess(session);
 return <div className="staff-workspace">
  <StaffNav role={session.role} name={session.name} access={access}/>
  <div className="staff-workspace-main" id="staff-content">{children}</div>
 </div>;
}
