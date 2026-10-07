export type LgaBoundaryFeature={
  type?:string;
  geometry?:{type?:string;coordinates?:unknown}|null;
  properties?:Record<string,unknown>;
};

export function normalizeLgaToken(value:unknown){
  return String(value??"")
    .trim()
    .toUpperCase()
    .replace(/&/g,"AND")
    .replace(/[^A-Z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
}

export function lgaFeatureCandidates(feature:LgaBoundaryFeature){
  const p=feature.properties||{};
  const codes=[
    p.code,p.lgaCode,p.lga_code,p.LGA_CODE,p.LGACODE,p.lgacode
  ].map(normalizeLgaToken).filter(Boolean);
  const names=[
    p.name,p.lga,p.lgaName,p.lga_name,p.LGA_NAME,p.NAME_2,p.NAME
  ].map(normalizeLgaToken).filter(Boolean);
  return {codes:[...new Set(codes)],names:[...new Set(names)]};
}

export function isBoundaryGeometry(type:unknown){
  return type==="Polygon"||type==="MultiPolygon";
}
