export type ComposerFeature={
  type:"Feature";
  id?:string;
  geometry:any;
  properties?:{
    id?:string;
    entityType?:string;
    name?:string|null;
    lga?:string|null;
    status?:string|null;
    riskLevel?:string|null;
  };
};

export const composerLayerOrder=["borehole","asset","forest_site","river","ndvi_change"] as const;
export type ComposerLayer=(typeof composerLayerOrder)[number];

export function filterComposerFeatures(features:ComposerFeature[],layers:ComposerLayer[],risk:string){
  const enabled=new Set(layers);
  return features.filter(feature=>{
    const p=feature.properties||{};
    if(!p.entityType||!enabled.has(p.entityType as ComposerLayer))return false;
    if(risk&&p.riskLevel!==risk)return false;
    return true;
  });
}

export function composerFeatureCounts(features:ComposerFeature[]){
  const counts:Record<string,number>={total:features.length};
  for(const feature of features){
    const key=feature.properties?.entityType||"unknown";
    counts[key]=(counts[key]||0)+1;
  }
  return counts;
}

export function featureCollection(features:ComposerFeature[]){
  return {type:"FeatureCollection" as const,features};
}

export function composerFilename(title:string){
  const clean=title.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
  return (clean||"care-map")+"-geojson.json";
}
