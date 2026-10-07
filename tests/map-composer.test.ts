import {describe,expect,it} from "vitest";
import {composerFeatureCounts,composerFilename,filterComposerFeatures,type ComposerFeature} from "../src/lib/map-composer";

const features:ComposerFeature[]=[
  {type:"Feature",geometry:{type:"Point",coordinates:[8.5,7.7]},properties:{entityType:"borehole",riskLevel:"low"}},
  {type:"Feature",geometry:{type:"Point",coordinates:[8.6,7.8]},properties:{entityType:"asset",riskLevel:"high"}},
  {type:"Feature",geometry:{type:"Polygon",coordinates:[]},properties:{entityType:"forest_site",riskLevel:"high"}},
  {type:"Feature",geometry:{type:"MultiPolygon",coordinates:[]},properties:{entityType:"ndvi_change",riskLevel:"critical"}},
  {type:"Feature",geometry:{type:"Point",coordinates:[8.7,7.9]},properties:{entityType:"settlement",name:"Community A"}},
  {type:"Feature",geometry:{type:"Polygon",coordinates:[]},properties:{entityType:"hazard_zone",riskLevel:"high",severity:"high"}},
  {type:"Feature",geometry:{type:"Polygon",coordinates:[]},properties:{entityType:"catchment",name:"Watershed A"}}
];

describe("map composer helpers",()=>{
  it("filters by selected layers and risk",()=>{
    expect(filterComposerFeatures(features,["asset","forest_site"],"high")).toHaveLength(2);
    expect(filterComposerFeatures(features,["borehole"],"")).toHaveLength(1);
    expect(filterComposerFeatures(features,["settlement","hazard_zone","catchment"],"high")).toHaveLength(3);
  });

  it("counts visible feature types",()=>{
    expect(composerFeatureCounts(features)).toEqual({
      total:7,borehole:1,asset:1,forest_site:1,ndvi_change:1,settlement:1,hazard_zone:1,catchment:1
    });
  });

  it("builds a safe GeoJSON filename",()=>{
    expect(composerFilename("Benue ACReSAL — October Map")).toBe("benue-acresal-october-map.geojson");
    expect(composerFilename("   ")).toBe("care-map.geojson");
  });
});
