import {redirect} from "next/navigation";
import Link from "next/link";
import {getSession,isAdmin} from "@/lib/auth";
import {currentInfrastructureSnapshot} from "@/lib/infrastructure";
import MigrationManager from "@/components/MigrationManager";

export const dynamic="force-dynamic";

export default async function AdminMigrationsPage(){
  const session=await getSession();
  if(!isAdmin(session))redirect("/login");
  const status=await currentInfrastructureSnapshot();
  return <div className="stack">
    <div className="section-head">
      <div>
        <span className="page-eyebrow">Administration / Database</span>
        <h1>Database migrations</h1>
        <p className="muted">Manage pending Aiven/PostGIS schema upgrades using your current signed-in administrator account.</p>
      </div>
      <Link href="/staff/infrastructure" className="btn">Infrastructure</Link>
    </div>
    <MigrationManager overview={{
      databaseReady:status.database.ok,
      databaseName:status.databaseName,
      expected:status.migrations.expected,
      applied:status.migrations.applied,
      pending:status.migrations.pending,
      checksumMismatches:status.migrations.checksumMismatches,
      latestAppliedAt:status.migrations.latestAppliedAt
    }}/>
  </div>;
}
