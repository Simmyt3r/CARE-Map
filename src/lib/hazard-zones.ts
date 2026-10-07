export const hazardTypes=[
  "flood","erosion","gully_erosion","land_degradation","landslide","other"
] as const;
export type HazardType=(typeof hazardTypes)[number];

export const hazardSeverities=["unknown","low","medium","high","critical"] as const;
export type HazardSeverity=(typeof hazardSeverities)[number];

export function isHazardType(value:unknown):value is HazardType{
  return hazardTypes.includes(String(value||"").trim().toLowerCase() as HazardType);
}

export function isHazardSeverity(value:unknown):value is HazardSeverity{
  return hazardSeverities.includes(String(value||"").trim().toLowerCase() as HazardSeverity);
}

export function hazardTypeLabel(value:HazardType){
  return value.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
}

export function hazardSeverityRank(value:HazardSeverity){
  return ({unknown:0,low:1,medium:2,high:3,critical:4} as const)[value];
}
