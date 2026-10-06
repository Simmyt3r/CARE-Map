import ReportForm from "@/components/ReportForm";
import {getPublicResource,type PublicKind} from "@/lib/public-resource";

const entityToKind:Record<string,PublicKind>={borehole:"boreholes",asset:"assets",forest_site:"forest-sites",river:"rivers"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic="force-dynamic";

export default async function ReportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const entityType=typeof params.entityType==="string"?params.entityType:"";
  const entityId=typeof params.entityId==="string"?params.entityId:"";
  const requestedName=typeof params.name==="string"?params.name:"";
  const kind=entityToKind[entityType];
  let resource:any=null;

  if(kind&&uuid.test(entityId)){
    resource=await getPublicResource(kind,entityId).catch(()=>null);
  }

  return <div className="stack">
    <div className="section-head"><div><h1>Community report</h1><div className="muted">You can report without creating an account. Coordinates can be captured from your phone or entered manually.</div></div></div>
    <ReportForm
      relatedEntityType={resource?entityType as "borehole"|"asset"|"forest_site"|"river":null}
      relatedEntityId={resource?entityId:null}
      relatedName={resource?String(resource.name):requestedName}
      initialLatitude={resource?String(resource.latitude):""}
      initialLongitude={resource?String(resource.longitude):""}
    />
  </div>;
}
