export const environmentalHazardTypes=["flood","erosion","landslide","wildfire","other"] as const;
export type EnvironmentalHazardType=(typeof environmentalHazardTypes)[number];

export const environmentalSeverities=["low","medium","high","critical"] as const;
export type EnvironmentalSeverity=(typeof environmentalSeverities)[number];

export function isEnvironmentalHazardType(value:unknown):value is EnvironmentalHazardType{
  return environmentalHazardTypes.includes(String(value||"").toLowerCase() as EnvironmentalHazardType);
}

export function isEnvironmentalSeverity(value:unknown):value is EnvironmentalSeverity{
  return environmentalSeverities.includes(String(value||"").toLowerCase() as EnvironmentalSeverity);
}

export function environmentalSeverityRank(value:unknown){
  const v=String(value||"").toLowerCase();
  return v==="critical"?4:v==="high"?3:v==="medium"?2:v==="low"?1:0;
}

export function normalizeEnvironmentalZoneCode(value:unknown){
  const text=String(value??"").trim().toUpperCase().replace(/[^A-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"");
  return text.slice(0,120);
}
