import Link from "next/link";
import {getSession,isAdmin} from "@/lib/auth";
import {loadWorkspaceAccess} from "@/lib/workspace-access";
import {WORKSPACES,canAccessWorkspace} from "@/lib/workspaces";
import {query} from "@/lib/db";

export const dynamic="force-dynamic";

type DashboardCounts={
 boreholes:string;functional:string;assets:string;forests:string;
 rivers:string;open_reports:string;high_risk:string;
};
type RiskRow={entity_type:string;name:string|null;lga_code:string;risk_score:number;risk_level:string};

export default async function StaffDashboard(){
 const session=await getSession();
 const access=await loadWorkspaceAccess(session);
 const admin=isAdmin(session);
 const canSeeOperations=admin||canAccessWorkspace(session?.role||"",access,"operations");
 const assigned=WORKSPACES.filter(item=>canAccessWorkspace(session?.role||"",access,item.id));
 let counts:DashboardCounts|null=null;
 let priorities:RiskRow[]=[];
 if(canSeeOperations){
  const [summary,ranked]=await Promise.all([
   query<DashboardCounts>(`SELECT
     (SELECT count(*) FROM boreholes) boreholes,
     (SELECT count(*) FROM boreholes WHERE status='functional') functional,
     (SELECT count(*) FROM assets) assets,
     (SELECT count(*) FROM forest_sites) forests,
     (SELECT count(*) FROM rivers WHERE verified) rivers,
     (SELECT count(*) FROM reports WHERE status IN ('submitted','under_review','verified')) open_reports,
     (SELECT count(*) FROM boreholes WHERE risk_level IN ('high','critical'))+
     (SELECT count(*) FROM assets WHERE risk_level IN ('high','critical'))+
     (SELECT count(*) FROM forest_sites WHERE risk_level IN ('high','critical'))+
     (SELECT count(*) FROM rivers WHERE risk_level IN ('high','critical')) high_risk`),
   query<RiskRow>(`SELECT entity_type,name,lga_code,risk_score,risk_level FROM (
     SELECT 'borehole' entity_type,name,lga_code,risk_score,risk_level FROM boreholes
     UNION ALL SELECT 'asset',name,lga_code,risk_score,risk_level FROM assets
     UNION ALL SELECT 'forest',name,lga_code,risk_score,risk_level FROM forest_sites
     UNION ALL SELECT 'river',COALESCE(name,local_name),lga_code,risk_score,risk_level FROM rivers WHERE verified
   ) ranked ORDER BY risk_score DESC LIMIT 8`)
  ]);
  counts=summary.rows[0]||null;
  priorities=ranked.rows;
 }
 const boreholes=Number(counts?.boreholes||0);
 const functionalRate=boreholes?Math.round(100*Number(counts?.functional||0)/boreholes):null;

 return <div className="stack">
  <div className="section-head">
   <div className="staff-page-lede">
    <span className="page-eyebrow">CARE-Map Nigeria / {admin?"Administration":"My workspaces"}</span>
    <h1>{admin?"Administrator overview":"My workspaces"}</h1>
    <p className="muted">{admin?
      "You can open and manage every interface. Workspaces are grouped so the menu stays compact.":
      "Only interfaces assigned to your account are shown. Ask an administrator if you need another tool."}</p>
   </div>
   {admin&&<Link className="btn primary" href="/staff/admin">Manage user access</Link>}
  </div>
  {canSeeOperations&&counts&&<div className="stats" aria-label="Current operational metrics">
   <div className="stat"><strong>{boreholes.toLocaleString()}</strong><span>Recorded boreholes</span></div>
   <div className="stat"><strong>{functionalRate===null?"—":functionalRate+"%"}</strong><span>Functional boreholes</span></div>
   <div className="stat"><strong>{Number(counts.open_reports||0).toLocaleString()}</strong><span>Open reports</span></div>
   <div className="stat"><strong>{Number(counts.high_risk||0).toLocaleString()}</strong><span>High-risk assets</span></div>
  </div>}
  <div className="section-head" style={{marginBottom:0}}>
   <div><h2>{admin?"All interfaces":"Assigned interfaces"}</h2>
    <p className="muted" style={{margin:"5px 0 0"}}>
     {assigned.length} available workspaces — choose an interface to begin.</p>
   </div>
  </div>
  <div className="workspace-shortcuts">
   {assigned.map(item=><Link href={item.href} key={item.id} className="workspace-shortcut">
    <strong>{item.title}</strong><span>{item.description}</span><b>Open workspace →</b>
   </Link>)}
  </div>
  {canSeeOperations&&<section className="card stack">
   <div className="section-head" style={{marginBottom:0}}>
    <div><h2>Risk priorities</h2>
     <p className="muted">Risk indicators require review of the underlying field evidence.</p></div>
    <Link href="/staff/operations" className="btn">Operations center</Link>
   </div>
   {priorities.length?<div className="table-wrap"><table>
    <thead><tr><th>Asset type</th><th>Name</th><th>LGA</th><th>Risk level</th><th>Score</th></tr></thead>
    <tbody>{priorities.map((item,index)=><tr key={item.entity_type+"-"+item.lga_code+"-"+index}>
     <td style={{textTransform:"capitalize"}}>{item.entity_type}</td><td><strong>{item.name||"Unnamed"}</strong></td>
     <td>{item.lga_code}</td>
     <td><span className={"priority-badge priority-"+item.risk_level}>{item.risk_level}</span></td>
     <td>{item.risk_score}</td>
    </tr>)}</tbody>
   </table></div>:<div className="empty-state">No priority risk records yet.</div>}
  </section>}
  {admin&&<section className="card stack">
   <h2>Administrative controls</h2>
   <p className="muted">Your administrator account has all operational and management permissions.</p>
   <div className="actions">
    <Link className="btn" href="/staff/admin">Users & access</Link>
    <Link className="btn" href="/staff/admin/migrations">Database migrations</Link>
    <Link className="btn" href="/staff/infrastructure">Infrastructure</Link>
   </div>
  </section>}
 </div>;
}
