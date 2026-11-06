import {
  NIGERIA_CENTER,NIGERIA_COUNTRY_CODE,NIGERIA_COUNTRY_NAME,NIGERIA_MAP_BOUNDS,
  isWithinNigeriaExtent,normalizeNigerianState
} from "@/lib/nigeria-geography";

/** Nigeria-wide platform; approved Nigerian state subdeployments are optional. */
export type DeploymentProfile={
  countryName:"Nigeria";
  countryCode:"NG";
  regionName:"Nigeria";
  /** Specific Nigerian state or nationwide fallback ("Nigeria"). */
  stateName:string;
  mapCenter:[number,number];
  mapZoom:number;
  mapBounds:[[number,number],[number,number]];
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
  const requested=(config.regionName||config.stateName||"Nigeria").trim();
  const nationwide=requested.toLowerCase()==="nigeria";
  const state=nationwide?null:normalizeNigerianState(requested);
  if(!nationwide&&!state)
    throw new Error("CARE-Map supports Nigeria and its 36 states/FCT only.");
  const approved=config.regionDataApproved==="true"||config.stateDataApproved==="true";
  if(state&&!approved)
    throw new Error("State-specific deployment requires approved Nigerian GIS data.");
  if(state&&(config.centerLongitude===undefined||config.centerLatitude===undefined))
    throw new Error("State-specific deployment requires a reviewed map centre.");
  const longitude=config.centerLongitude===undefined?NIGERIA_CENTER[0]:Number(config.centerLongitude);
  const latitude=config.centerLatitude===undefined?NIGERIA_CENTER[1]:Number(config.centerLatitude);
  const zoom=config.zoom===undefined?(state?7:5):Number(config.zoom);
  if(!isWithinNigeriaExtent(latitude,longitude)||!Number.isFinite(zoom)||zoom<1||zoom>15)
    throw new Error("CARE-Map map centre must be within Nigeria's geographic extent, with a valid zoom.");
  return{
    countryName:NIGERIA_COUNTRY_NAME,countryCode:NIGERIA_COUNTRY_CODE,
    regionName:"Nigeria",stateName:state||"Nigeria",
    mapCenter:[longitude,latitude],mapZoom:zoom,mapBounds:NIGERIA_MAP_BOUNDS
  };
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
