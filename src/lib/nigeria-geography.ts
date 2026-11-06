/**
 * CARE-Map operates in Nigeria (NG/NGA) only.
 * This approximate WGS84 envelope is a screening bound, not a precise legal
 * international border. Marginal records require reviewed state/LGA polygons.
 */
export const NIGERIA_COUNTRY_CODE="NG" as const;
export const NIGERIA_COUNTRY_NAME="Nigeria" as const;
export const NIGERIA_CENTER:[number,number]=[8.6753,9.0820];
export const NIGERIA_EXTENT={west:2.60,south:4.20,east:14.75,north:14.00} as const;
export const NIGERIA_MAP_BOUNDS:[[number,number],[number,number]]=[
  [2.25,3.85],[15.10,14.35]
];

export const NIGERIAN_STATES=[
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa",
  "Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger",
  "Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
  "Federal Capital Territory"
] as const;
export function normalizeNigerianState(value:string):string|null{
  const name=value.trim().replace(/\s+State$/i,"");
  if(/^(FCT|FCT Abuja|Abuja|Federal Capital Territory)$/i.test(name))return "Federal Capital Territory";
  return NIGERIAN_STATES.find(state=>state.toLowerCase()===name.toLowerCase())||null;
}
export function isWithinNigeriaExtent(latitude:number,longitude:number){
  return Number.isFinite(latitude)&&Number.isFinite(longitude)&&
    latitude>=NIGERIA_EXTENT.south&&latitude<=NIGERIA_EXTENT.north&&
    longitude>=NIGERIA_EXTENT.west&&longitude<=NIGERIA_EXTENT.east;
}

/** Screen all vertices of a GeoJSON geometry, including Multi* shapes. */
export function assertNigeriaGeometry(value:unknown){
  const geometry=typeof value==="string"?JSON.parse(value):value;
  if(!geometry||typeof geometry!=="object"||!("coordinates" in geometry))
    throw new Error("A valid GeoJSON geometry is required.");
  let count=0;
  function visit(node:unknown){
    if(!Array.isArray(node)||!node.length)
      throw new Error("Invalid GeoJSON coordinate structure.");
    if(typeof node[0]==="number"||typeof node[1]==="number"){
      if(node.length<2||!isWithinNigeriaExtent(Number(node[1]),Number(node[0])))
        throw new Error("CARE-Map only imports geographic records within Nigeria's screening extent.");
      count++;
      if(count>200_000)throw new Error("GeoJSON has too many coordinates.");
    }else{
      for(const part of node)visit(part);
    }
  }
  visit((geometry as {coordinates:unknown}).coordinates);
  if(!count)throw new Error("GeoJSON geometry has no coordinates.");
}
