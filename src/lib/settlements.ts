export const settlementTypes=["community","village","town","city","camp","other"] as const;
export type SettlementType=(typeof settlementTypes)[number];

export function isSettlementType(value:unknown):value is SettlementType{
  return settlementTypes.includes(String(value||"").toLowerCase() as SettlementType);
}

export function parseOptionalPopulation(value:unknown){
  if(value==null||String(value).trim()==="")return null;
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>100_000_000)return undefined;
  return n;
}

export function parseOptionalPopulationYear(value:unknown){
  if(value==null||String(value).trim()==="")return null;
  const n=Number(value);
  if(!Number.isInteger(n)||n<1900||n>2200)return undefined;
  return n;
}

export function parseOptionalGpsAccuracy(value:unknown){
  if(value==null||String(value).trim()==="")return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>100_000)return undefined;
  return n;
}

export function parseSettlementAccessRadius(value:unknown){
  const n=Number(value);
  if(!Number.isFinite(n)||n<100||n>50_000)return null;
  return Math.round(n);
}

export function populationProvenanceError(population:number|null,populationSource:unknown,populationYear:number|null){
  if(population!=null&&!String(populationSource||"").trim()){
    return "Population source is required when population is provided.";
  }
  if(population==null&&populationYear!=null){
    return "Population year cannot be provided without population.";
  }
  return null;
}
