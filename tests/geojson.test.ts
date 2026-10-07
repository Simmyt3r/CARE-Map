import {describe,expect,it} from "vitest";
import {geometryExtent} from "../src/lib/geojson";

describe("geometryExtent",()=>{
  it("calculates an extent for nested polygon coordinates",()=>{
    expect(geometryExtent({
      coordinates:[[[8.4,7.1],[8.9,7.2],[8.8,7.8],[8.4,7.1]]]
    })).toEqual([8.4,7.1,8.9,7.8]);
  });

  it("handles multipolygon nesting",()=>{
    expect(geometryExtent({
      coordinates:[
        [[[8,7],[8.2,7.3],[8,7]]],
        [[[9,8],[9.5,8.4],[9,8]]]
      ]
    })).toEqual([8,7,9.5,8.4]);
  });

  it("returns null for empty geometry",()=>{
    expect(geometryExtent({coordinates:[]})).toBeNull();
  });
});
