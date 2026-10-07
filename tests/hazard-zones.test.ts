import {describe,expect,it} from "vitest";
import {
  hazardSeverityRank,
  hazardTypeLabel,
  isHazardSeverity,
  isHazardType
} from "../src/lib/hazard-zones";

describe("hazard zone helpers",()=>{
  it("validates supported hazard types",()=>{
    expect(isHazardType("flood")).toBe(true);
    expect(isHazardType("gully_erosion")).toBe(true);
    expect(isHazardType("cyclone")).toBe(false);
  });

  it("validates supported hazard severities",()=>{
    expect(isHazardSeverity("unknown")).toBe(true);
    expect(isHazardSeverity("critical")).toBe(true);
    expect(isHazardSeverity("extreme")).toBe(false);
  });

  it("creates readable type labels",()=>{
    expect(hazardTypeLabel("gully_erosion")).toBe("Gully Erosion");
    expect(hazardTypeLabel("land_degradation")).toBe("Land Degradation");
  });

  it("orders severity without pretending unknown means low",()=>{
    expect(hazardSeverityRank("unknown")).toBe(0);
    expect(hazardSeverityRank("low")).toBe(1);
    expect(hazardSeverityRank("critical")).toBe(4);
  });
});
