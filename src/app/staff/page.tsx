import Link from "next/link";
import {query} from "@/lib/db";
export const dynamic="force-dynamic";

const shortcuts=[
  {href:"/staff/extension",title:"Community extension",description:"Register intervention contacts, coordinate field visits and review stewardship."},
  {href:"/staff/gis",title:"GIS workbench",description:"Upload sourced spatial datasets, inspect validation and export for QGIS."},
  {href:"/staff/remote-sensing",title:"Sentinel-2 analysis",description:"Compare vegetation across dates using clear-pixel quality checks."},
  {href:"/staff/operations",title:"Operations center",description:"Prioritize issues, unresolved reports and risk signals."},
  {href:"/staff/analysis",title:"Spatial analysis",description:"Study settlement access, hazards and watershed exposure."},
  {href:"/staff/map-composer",title:"Map composer",description:"Prepare evidence-backed maps and presentation exports."}
];
type DashboardCounts={
  boreholes:string;functional:string;assets:string;forests:string;
  rivers:string;open_reports:string;high_risk:string
};
type RiskRow={entity_type:string;name:string|null;lga_code:string;risk_score:number;risk_level:string};

export default async function StaffDashboard(){
 const [r,ranking]=await Promise.all([
  query<DashboardCounts>(`SELECT
    (SELECT count(*) FROM boreholes) boreholes,
    (SELECT count(*) FROM boreholes WHERE status='functional') functional,
    (SELECT count(*) FROM assets) assets,
    (SELECT count(*) FROM forest_sites) forests,
    (SELECT count(*) FROM rivers WHERE verified) rivers,
    (SELECT count(*) FROM reports WHERE status IN('submitted','under_review','verified')) open_reports,
    (SELECT count(*) FROM boreholes WHERE risk_level IN('high','critical'))+
    (SELECT count(*) FROM assets WHERE risk_level IN('high','critical'))+
    (SELECT count(*) FROM forest_sites WHERE risk_level IN('high','critical'))+
    (SELECT count(*) FROM rivers WHERE risk_level IN('high','critical')) high_risk`),
  query<RiskRow>(`SELECT entity_type,name,lga_code,risk_score,risk_level FROM (
    SELECT 'borehole' entity_type,name,lga_code,risk_score,risk_level FROM boreholes
    UNION ALL SELECT 'asset',name,lga_code,risk_score,risk_level FROM assets
    UNION ALL SELECT 'forest',name,lga_code,risk_score,risk_level FROM forest_sites
    UNION ALL SELECT 'river',COALESCE(name,local_name),lga_code,risk_score,risk_level
      FROM rivers WHERE verified
  ) x ORDER BY risk_score DESC LIMIT 8`)
 ]);
 const x=r.rows[0],b=Number(x.boreholes||0),rate=b?Math.round(Number(x.functional)*100/b):null;
 return <div className="stack">
  <div className="section-head">
    <div className="staff-page-lede">
      <span className="page-eyebrow">Benue ACReSAL / Operational overview</span>
      <h1>Welcome to CARE-Map</h1>
      <p className="muted">Explore verified geographic evidence, manage community interventions and keep field follow-ups moving.</p>
    </div>
    <Link className="btn primary" href="/staff/extension">Manage interventions</Link>
  </div>
  <div className="stats" aria-label="Live environmental and infrastructure metrics">
    <div className="stat"><strong>{Number(x.boreholes||0).toLocaleString()}</strong><span className="metric-label">Recorded boreholes</span></div>
    <div className="stat"><strong>{rate===null?"—":rate+"%"}</strong><span className="metric-label">Functional boreholes</span></div>
    <div className="stat"><strong>{Number(x.open_reports||0).toLocaleString()}</strong><span className="metric-label">Open community reports</span></div>
    <div className="stat"><strong>{Number(x.high_risk||0).toLocaleString()}</strong><span className="metric-label">High-risk mapped assets</span></div>
  </div>
  <div className="section-head" style={{marginBottom:0}}><div><h2>Quick access</h2><p className="muted" style={{margin:"5px 0 0"}}>Start where the work happens instead of hunting through every menu.</p></div></div>
  <div className="workspace-shortcuts">
    {shortcuts.map(s=><Link href={s.href} key={s.href} className="workspace-shortcut">
      <strong>{s.title}</strong><span>{s.description}</span><b>Open workspace →</b>
    </Link>)}
  </div>
  <section className="card stack">
    <div className="section-head" style={{marginBottom:0}}>
      <div><h2>Risk priorities</h2><p className="muted" style={{margin:"4px 0 0"}}>Current mapped risk scores. Review the underlying evidence before taking action.</p></div>
      <Link href="/staff/operations" className="btn">All operations</Link>
    </div>
    {ranking.rows.length?<div className="table-wrap"><table>
      <thead><tr><th>Asset type</th><th>Name</th><th>LGA</th><th>Risk level</th><th>Score</th></tr></thead>
      <tbody>{ranking.rows.map((row,i)=><tr key={row.entity_type+"-"+row.lga_code+"-"+i}>
        <td style={{textTransform:"capitalize"}}>{row.entity_type}</td><td><strong>{row.name||"Unnamed"}</strong></td>
        <td>{row.lga_code}</td><td><span className={"priority-badge priority-"+row.risk_level}>{row.risk_level}</span></td>
        <td>{row.risk_score}</td>
      </tr>)}</tbody>
    </table></div>:<div className="empty-state"><strong>No priority risk records yet</strong>
      <p>Assets and verified field observations will appear here as the GIS inventory grows.</p>
      <Link className="btn" href="/staff/data">Open field assets</Link>
    </div>}
  </section>
  <section className="card stack">
    <div className="section-head" style={{marginBottom:0}}><h2>Other mapped resources</h2><Link href="/staff/gis" className="btn">Data quality</Link></div>
    <div className="grid three">
      <div className="stat"><strong>{Number(x.assets||0).toLocaleString()}</strong><span>Infrastructure assets</span></div>
      <div className="stat"><strong>{Number(x.forests||0).toLocaleString()}</strong><span>Forest and restoration sites</span></div>
      <div className="stat"><strong>{Number(x.rivers||0).toLocaleString()}</strong><span>Verified rivers</span></div>
    </div>
  </section>
 </div>;
}
