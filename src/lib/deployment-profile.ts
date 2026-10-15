/**
 * Per-deployment presentation defaults. CARE-Map is currently a Benue dataset.
 * These labels/viewport settings are NOT cross-state data isolation.
 *
 * Other-state launches require their own DB, reviewed state/LGA dataset,
 * translation packs, spatial sources, policies and acceptance sign-off.
 */
export type DeploymentProfile={
  stateName:string;
  mapCenter:[number,number];
  mapZoom:number;
  defaultBenue:boolean;
};
export function parseDeploymentProfile(config:{
  stateName?:string;
  centerLongitude?:string;
  centerLatitude?:string;
  zoom?:string;
  stateDataApproved?:string;
}={}):DeploymentProfile{
  const stateName=(config.stateName||"Benue").trim();
  if(!/^[A-Za-z][A-Za-z .'-]{1,69}$/.test(stateName))
    throw new Error("CARE-Map state name must be a normal geographic name.");
  const defaultBenue=stateName.toLowerCase()==="benue";
  if(!defaultBenue&&config.stateDataApproved!=="true")
    throw new Error("Other-state deployment requires explicit state dataset acceptance before public branding changes.");
  const longitude=config.centerLongitude===undefined?8.7:Number(config.centerLongitude);
  const latitude=config.centerLatitude===undefined?7.35:Number(config.centerLatitude);
  const zoom=config.zoom===undefined?6.5:Number(config.zoom);
  if(!Number.isFinite(latitude)||latitude< -90||latitude>90||
     !Number.isFinite(longitude)||longitude< -180||longitude>180||
     !Number.isFinite(zoom)||zoom<3||zoom>15)
    throw new Error("Invalid CARE-Map deployment map center or zoom.");
  if(!defaultBenue&&(config.centerLongitude===undefined||config.centerLatitude===undefined))
    throw new Error("Other-state deployment must provide its reviewed map center coordinates.");
  return {stateName,defaultBenue,mapCenter:[longitude,latitude],mapZoom:zoom};
}
export const deploymentProfile=parseDeploymentProfile({
  stateName:process.env.NEXT_PUBLIC_CAREMAP_STATE_NAME,
  centerLongitude:process.env.NEXT_PUBLIC_CAREMAP_MAP_LONGITUDE,
  centerLatitude:process.env.NEXT_PUBLIC_CAREMAP_MAP_LATITUDE,
  zoom:process.env.NEXT_PUBLIC_CAREMAP_MAP_ZOOM,
  stateDataApproved:process.env.NEXT_PUBLIC_CAREMAP_STATE_DATA_APPROVED
});
