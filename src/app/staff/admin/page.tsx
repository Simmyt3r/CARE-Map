import {redirect} from "next/navigation";
import {getSession,isAdmin} from "@/lib/auth";
import AdminUsers from "@/components/AdminUsers";
export const dynamic="force-dynamic";
export default async function AdminPage(){const session=await getSession();if(!isAdmin(session))redirect("/staff");return <div className="stack"><div><h1>User administration</h1><div className="muted">Create staff, administrators and registered community accounts.</div></div><AdminUsers/></div>}
