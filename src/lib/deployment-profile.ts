/**
 * Region-neutral presentation settings. These values do not create data
 * isolation: each deployment must use its own reviewed GIS data and database.
 * A regional label is allowed only after explicit dataset approval.
 */
export type DeploymentProfile={
  regionName:string;
  /** Compatibility alias for legacy consumers; prefer regionName. */
  stateName:string;
  mapCenter:[number,number];
  mapZoom:number;
};
export function parseDeploymentProfile(config:{
  regionName?:string;
  stateName?:string;
  centerLongitude?:string;
  centerLatitude?:string;
  zoom?:string;
  regionDataApproved?:string;
  stateDataApproved?:string;
}={}):DeploymentProfile{
  const regionName=(config.regionName||config.stateName||"Global").trim();
  if(!/^[A-Za-z][A-Za-z0-9 .,'()-]{1,79}$/.test(regionName))
    throw new Error("CARE-Map region name must be a normal geographic name.");
  const global=regionName.toLowerCase()==="global";
  const approved=config.regionDataApproved==="true"||config.stateDataApproved==="true";
  if(!global&&!approved)
    throw new Error("Regional deployment requires explicit dataset acceptance before public branding changes.");
  if(!global&&(config.centerLongitude===undefined||config.centerLatitude===undefined))
    throw new Error("Regional deployment must provide its reviewed map center coordinates.");
  const longitude=config.centerLongitude===undefined?0:Number(config.centerLongitude);
  const latitude=config.centerLatitude===undefined?0:Number(config.centerLatitude);
  const zoom=config.zoom===undefined?(global?2:6):Number(config.zoom);
  if(!Number.isFinite(latitude)||latitude< -90||latitude>90||
     !Number.isFinite(longitude)||longitude< -180||longitude>180||
     !Number.isFinite(zoom)||zoom<1||zoom>15)
    throw new Error("Invalid CARE-Map deployment map center or zoom.");
  return {regionName,stateName:regionName,mapCenter:[longitude,latitude],mapZoom:zoom};
}
export const deploymentProfile=parseDeploymentProfile({
  regionName:process.env.NEXT_PUBLIC_CAREMAP_REGION_NAME,
  stateName:process.env.NEXT_PUBLIC_CAREMAP_STATE_NAME,
  centerLongitude:process.env.NEXT_PUBLIC_CAREMAP_MAP_LONGITUDE,
  centerLatitude:process.env.NEXT_PUBLIC_CAREMAP_MAP_LATITUDE,
  zoom:process.env.NEXT_PUBLIC_CAREMAP_MAP_ZOOM,
  regionDataApproved:process.env.NEXT_PUBLIC_CAREMAP_REGION_DATA_APPROVED,
  stateDataApproved:process.env.NEXT_PUBLIC_CAREMAP_STATE_DATA_APPROVED
});
