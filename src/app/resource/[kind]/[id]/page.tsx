/* eslint-disable @next/next/no-img-element */
import type {Metadata} from "next";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import QRCode from "qrcode";
import PublicResourceMap from "@/components/PublicResourceMap";
import PrintButton from "@/components/PrintButton";
import {getPublicResource,isPublicKind,type PublicKind} from "@/lib/public-resource";

export const dynamic="force-dynamic";

function kindLabel(kind:PublicKind){
  return kind==="boreholes"?"Borehole":kind==="assets"?"Asset":kind==="forest-sites"?"Forest / afforestation site":"River";
}

async function absoluteUrl(kind:string,id:string){
  const h=await headers();
  const host=h.get("x-forwarded-host")||h.get("host")||"localhost:3000";
  const proto=h.get("x-forwarded-proto")||(host.includes("localhost")?"http":"https");
  return proto+"://"+host+"/resource/"+kind+"/"+id;
}

export async function generateMetadata({params}:{params:Promise<{kind:string;id:string}>}):Promise<Metadata>{
  const{kind,id}=await params;
  if(!isPublicKind(kind))return{title:"Resource not found | CARE-Map"};
  const resource=await getPublicResource(kind,id);
  if(!resource)return{title:"Resource not found | CARE-Map"};
  return{
    title:String(resource.name)+" | CARE-Map",
    description:"Public CARE-Map record for "+String(resource.name)+" in "+String(resource.lga_code)+"."
  };
}

export default async function PublicResourcePage({params}:{params:Promise<{kind:string;id:string}>}){
  const{kind,id}=await params;
  if(!isPublicKind(kind))notFound();
  const resource=await getPublicResource(kind,id);
  if(!resource)notFound();

  const url=await absoluteUrl(kind,id);
  const qr=await QRCode.toDataURL(url,{errorCorrectionLevel:"M",margin:1,width:320});
  const reportUrl="/report?entityType="+encodeURIComponent(resource.entityType)+"&entityId="+encodeURIComponent(String(resource.id))+"&name="+encodeURIComponent(String(resource.name));
  const coords=Number(resource.latitude).toFixed(6)+", "+Number(resource.longitude).toFixed(6);

  return <div className="resource-public stack">
    <section className="resource-hero card">
      <div>
        <span className="badge">{kindLabel(kind)}</span>
        <h1>{String(resource.name)}</h1>
        <div className="resource-subtitle">{resource.code?String(resource.code)+" · ":""}{String(resource.lga_code)} · <strong>{String(resource.status)}</strong></div>
        <p className="muted">{resource.description?String(resource.description):"No public description has been recorded for this resource."}</p>
        <div className="actions no-print"><a className="btn primary" href={reportUrl}>Report a problem with this resource</a><PrintButton/></div>
      </div>
      <div className="resource-risk">
        <small>Current risk</small>
        <strong>{String(resource.risk_level)}</strong>
        <span>{Number(resource.risk_score)||0}/100</span>
      </div>
    </section>

    <section className="grid two resource-main-grid">
      <div className="card stack">
        <h2>Location</h2>
        <PublicResourceMap geometry={resource.geometry as any} name={String(resource.name)}/>
        <div className="resource-facts">
          <div><span>Coordinates</span><strong>{coords}</strong></div>
          <div><span>LGA</span><strong>{String(resource.lga_code)}</strong></div>
          {resource.gps_accuracy_m!=null&&<div><span>Recorded GPS accuracy</span><strong>±{Number(resource.gps_accuracy_m).toFixed(1)} m</strong></div>}
          {resource.capture_source&&<div><span>Capture source</span><strong>{String(resource.capture_source).replaceAll("_"," ")}</strong></div>}
        </div>
      </div>

      <div className="stack">
        <section className="card">
          <h2>Public record summary</h2>
          <div className="resource-facts">
            {resource.subtype&&<div><span>Type</span><strong>{String(resource.subtype).replaceAll("_"," ")}</strong></div>}
            {resource.installation_date&&<div><span>Installed</span><strong>{new Date(String(resource.installation_date)).toLocaleDateString()}</strong></div>}
            {resource.last_maintenance_date&&<div><span>Last maintenance</span><strong>{new Date(String(resource.last_maintenance_date)).toLocaleDateString()}</strong></div>}
            <div><span>Inspections recorded</span><strong>{Number(resource.inspectionSummary?.total||0)}</strong></div>
            {resource.inspectionSummary?.last_inspected_at&&<div><span>Last inspection</span><strong>{new Date(String(resource.inspectionSummary.last_inspected_at)).toLocaleDateString()} · {String(resource.inspectionSummary.last_condition||"")}</strong></div>}
            {(kind==="boreholes"||kind==="assets")&&<div><span>Maintenance records</span><strong>{Number(resource.maintenanceSummary?.total||0)}</strong></div>}
          </div>
        </section>

        <section className="resource-qr-label card">
          <div className="qr-brand">CARE-Map · Benue ACReSAL</div>
          <img src={qr} alt={"QR code for "+String(resource.name)} width={240} height={240}/>
          <h2>{String(resource.name)}</h2>
          {resource.code&&<strong className="qr-code">{String(resource.code)}</strong>}
          <div>{kindLabel(kind)} · {String(resource.lga_code)}</div>
          <small>Scan to view this record or report a problem.</small>
        </section>
      </div>
    </section>

    {!!resource.photos?.length&&<section className="card stack">
      <div className="section-head"><div><h2>Site photographs</h2><div className="muted">Public field photographs attached by CARE-Map staff.</div></div><span className="badge">{resource.photos.length}</span></div>
      <div className="resource-photo-grid">{resource.photos.map((p:any)=><a href={p.url} target="_blank" rel="noreferrer" key={p.id}><img src={p.url} alt={p.caption||String(resource.name)}/><div><strong>{p.caption||"Site photograph"}</strong><small>{new Date(p.uploaded_at).toLocaleDateString()}</small></div></a>)}</div>
    </section>}
  </div>;
}
