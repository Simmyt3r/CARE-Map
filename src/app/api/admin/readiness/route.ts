import {NextResponse} from "next/server";
import {getSession,isAdmin} from "@/lib/auth";
import {currentInfrastructureSnapshot} from "@/lib/infrastructure";
import {error} from "@/lib/http";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();
  if(!isAdmin(session))return error("Administrator access required.",403,"FORBIDDEN");
  const snapshot=await currentInfrastructureSnapshot();
  return NextResponse.json({
    environment:snapshot.environment,
    database:{
      configured:snapshot.databaseConfigured,
      reachable:snapshot.database.ok,
      host:snapshot.databaseHost,
      name:snapshot.databaseName,
      postgisEnabled:Boolean(snapshot.database.postgisEnabled),
      postgisVersion:snapshot.database.postgisVersion||null
    },
    migrations:snapshot.migrations,
    data:snapshot.data,
    readiness:snapshot.readiness,
    items:snapshot.readinessItems
  });
}
