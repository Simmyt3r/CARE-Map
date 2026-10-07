export function parseRiverCorridorRadius(value:unknown){
  const n=Number(value);
  if(!Number.isFinite(n)||n<50||n>20_000)return null;
  return Math.round(n);
}

export function riverCorridorScopeLabel(riverName?:string|null){
  return riverName?.trim()?riverName.trim():"All verified rivers in selected LGA";
}
