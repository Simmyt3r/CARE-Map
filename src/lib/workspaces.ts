/** Assignable staff interfaces. Admins always have every interface. */
export const WORKSPACES=[
  {id:"operations",title:"Operations",group:"Operations",href:"/staff/operations",description:"Priority work, assignments, escalations and case oversight",short:"OP"},
  {id:"reports",title:"Community reports",group:"Operations",href:"/staff/reports",description:"Review, verify, resolve and follow up on incoming reports",short:"RP"},
  {id:"extension",title:"Community extension",group:"Community",href:"/staff/extension",description:"Community contacts, visits and stewardship assessments",short:"EX"},
  {id:"finance",title:"Community fund monitoring",group:"Community",href:"/staff/crf",description:"Restricted community-fund records and accountability",short:"CF"},
  {id:"field",title:"Field assets",group:"Field & quality",href:"/staff/data",description:"Capture and update environmental assets and field observations",short:"FA"},
  {id:"quality",title:"Field acceptance",group:"Field & quality",href:"/staff/field-acceptance",description:"Device, GPS and operational field acceptance checks",short:"QA"},
  {id:"gis",title:"GIS workbench",group:"GIS & mapping",href:"/staff/gis",description:"Import, validate and manage reviewed spatial datasets",short:"GIS"},
  {id:"analysis",title:"Spatial analysis",group:"GIS & mapping",href:"/staff/analysis",description:"Location-based vulnerability, coverage and exposure analysis",short:"AN"},
  {id:"maps",title:"Map composer",group:"GIS & mapping",href:"/staff/map-composer",description:"Compose and export analytical maps",short:"MP"},
  {id:"satellite",title:"Sentinel-2 analysis",group:"Climate monitoring",href:"/staff/remote-sensing",description:"Vegetation comparisons and statewide satellite processing",short:"S2"},
  {id:"monitoring",title:"Vegetation monitoring",group:"Climate monitoring",href:"/staff/remote-sensing/monitoring",description:"Scheduled monitoring, alerts and field verification",short:"VM"}
] as const;
export type WorkspaceId=(typeof WORKSPACES)[number]["id"];
export const ALL_WORKSPACE_IDS:WorkspaceId[]=WORKSPACES.map(x=>x.id);
export const DEFAULT_STAFF_WORKSPACES:WorkspaceId[]=["reports","field"];
export const WORKSPACE_PRESETS=[
  {id:"field-officer",title:"Field officer",modules:["field","reports","quality"]},
  {id:"gis-officer",title:"GIS officer",modules:["gis","field","analysis","maps"]},
  {id:"climate-analyst",title:"Climate analyst",modules:["satellite","monitoring","analysis","maps"]},
  {id:"community-officer",title:"Community officer",modules:["extension","reports","operations"]},
  {id:"operations-officer",title:"Operations officer",modules:["operations","reports","quality"]},
  {id:"finance-officer",title:"Finance officer",modules:["finance"]},
  {id:"custom",title:"Custom permissions",modules:[]}
] as const;

const known=new Set<string>(ALL_WORKSPACE_IDS);
export function parseWorkspaceAccess(value:unknown):WorkspaceId[]|null{
  if(!Array.isArray(value)||value.length>ALL_WORKSPACE_IDS.length)return null;
  if(!value.every(item=>typeof item==="string"&&known.has(item)))return null;
  const access=[...new Set(value)] as WorkspaceId[];
  return access.length?access:null;
}
export function canAccessWorkspace(role:string,access:readonly string[],workspace:WorkspaceId){
  return role==="admin"||(role==="staff"&&access.includes(workspace));
}
export function canAccessAnyWorkspace(role:string,access:readonly string[],workspaces:readonly WorkspaceId[]){
  return role==="admin"||(role==="staff"&&workspaces.some(x=>access.includes(x)));
}
export type RouteAccess="admin"|WorkspaceId[]|null;
function starts(path:string,prefix:string){
  return path===prefix||path.startsWith(prefix+"/");
}
/**
 * Server-side route policy, shared by page UI and the Next.js proxy.
 * null means this request continues through its existing public/route auth.
 * Admin always overrides workspaces but not the endpoint's original restrictions.
 */
export function requiredWorkspaceAccess(path:string,method="GET"):RouteAccess{
  const action=method.toUpperCase();
  if(starts(path,"/staff/admin")||starts(path,"/staff/infrastructure")||
     starts(path,"/api/admin"))return "admin";
  if(starts(path,"/staff")){
    if(path==="/staff")return null;
    if(starts(path,"/staff/remote-sensing/monitoring"))return ["monitoring"];
    const match=WORKSPACES.find(item=>starts(path,item.href));
    return match?[match.id]:null;
  }
  if(starts(path,"/api/crf")){
    return starts(path,"/api/crf/access")?"admin":["finance"];
  }
  if(starts(path,"/api/extension"))return ["extension"];
  if(starts(path,"/api/field-acceptance"))return ["quality"];
  if(starts(path,"/api/gis")){
    if(starts(path,"/api/gis/analysis"))return ["analysis"];
    if(starts(path,"/api/gis/export"))return ["gis","maps"];
    if(path==="/api/gis/lga-boundaries"&&action==="GET")return null;
    return ["gis"];
  }
  if(starts(path,"/api/resources")){
    // Existing resource listing is public. Photos/inspections are staff-only.
    if(/^\/api\/resources\/[^/]+$/.test(path)&&action==="GET")return null;
    return ["field"];
  }
  if(starts(path,"/api/reports")){
    // Public submission and personal reports remain available to citizens.
    if(path==="/api/reports"&&action==="POST")return null;
    if(starts(path,"/api/reports/mine"))return null;
    return ["reports"];
  }
  if(starts(path,"/api/remote-sensing")){
    if(starts(path,"/api/remote-sensing/monitors"))return ["monitoring","satellite"];
    if(starts(path,"/api/remote-sensing/alerts"))return ["monitoring","satellite","operations"];
    return ["satellite"];
  }
  if(starts(path,"/api/dashboard/export"))return ["field","gis","maps"];
  if(starts(path,"/api/dashboard")||starts(path,"/api/operations"))return ["operations"];
  if(starts(path,"/api/predictions"))return ["operations","analysis"];
  return null;
}
