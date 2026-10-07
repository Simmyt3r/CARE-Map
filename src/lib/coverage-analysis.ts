export const coverageResourceTypes=["borehole","asset"] as const;
export type CoverageResourceType=(typeof coverageResourceTypes)[number];

export const coverageScenarios=["functional","non_decommissioned"] as const;
export type CoverageScenario=(typeof coverageScenarios)[number];

export function parseCoverageRadius(value:unknown){
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  if(n<100||n>50_000)return null;
  return Math.round(n);
}

export function isCoverageResourceType(value:unknown):value is CoverageResourceType{
  return coverageResourceTypes.includes(value as CoverageResourceType);
}

export function isCoverageScenario(value:unknown):value is CoverageScenario{
  return coverageScenarios.includes(value as CoverageScenario);
}

export function coverageScenarioLabel(value:CoverageScenario){
  return value==="functional"?"Functional only":"Mapped footprint (non-decommissioned)";
}
