export const catchmentLevels=[
  "basin","watershed","subcatchment","microcatchment","project_landscape","other"
] as const;
export type CatchmentLevel=(typeof catchmentLevels)[number];

export function isCatchmentLevel(value:unknown):value is CatchmentLevel{
  return catchmentLevels.includes(String(value||"").trim().toLowerCase() as CatchmentLevel);
}

export function catchmentLevelLabel(value:CatchmentLevel){
  return value.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
}

export function normalizeCatchmentCode(value:unknown){
  const text=String(value??"").trim().toUpperCase().replace(/[^A-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"");
  return text||null;
}
