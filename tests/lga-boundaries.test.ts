import {describe,expect,it} from "vitest";
import {isBoundaryGeometry,lgaFeatureCandidates,normalizeLgaToken} from "../src/lib/lga-boundaries";

describe("LGA boundary helpers",()=>{
  it("normalizes LGA codes and names consistently",()=>{
    expect(normalizeLgaToken("Gwer East")).toBe("GWER_EAST");
    expect(normalizeLgaToken("Katsina-Ala")).toBe("KATSINA_ALA");
    expect(normalizeLgaToken("  Ogbadibo ")).toBe("OGBADIBO");
  });

  it("extracts common GeoJSON LGA property names",()=>{
    const result=lgaFeatureCandidates({
      type:"Feature",
      geometry:{type:"Polygon",coordinates:[]},
      properties:{LGA_NAME:"Gwer West",lga_code:"GWER_WEST"}
    });
    expect(result.codes).toContain("GWER_WEST");
    expect(result.names).toContain("GWER_WEST");
  });

  it("only accepts polygonal administrative boundaries",()=>{
    expect(isBoundaryGeometry("Polygon")).toBe(true);
    expect(isBoundaryGeometry("MultiPolygon")).toBe(true);
    expect(isBoundaryGeometry("LineString")).toBe(false);
  });
});
