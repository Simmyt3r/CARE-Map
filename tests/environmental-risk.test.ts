import {describe,expect,it} from "vitest";
import {
  environmentalSeverityRank,
  isEnvironmentalHazardType,
  isEnvironmentalSeverity,
  normalizeEnvironmentalZoneCode
} from "../src/lib/environmental-risk";

describe("environmental risk helpers",()=>{
  it("validates supported hazard types",()=>{
    expect(isEnvironmentalHazardType("flood")).toBe(true);
    expect(isEnvironmentalHazardType("erosion")).toBe(true);
    expect(isEnvironmentalHazardType("earthquake")).toBe(false);
  });

  it("validates and ranks operational severity",()=>{
    expect(isEnvironmentalSeverity("critical")).toBe(true);
    expect(isEnvironmentalSeverity("extreme")).toBe(false);
    expect(environmentalSeverityRank("low")).toBe(1);
    expect(environmentalSeverityRank("critical")).toBe(4);
  });

  it("normalizes optional zone codes",()=>{
    expect(normalizeEnvironmentalZoneCode(" Benue flood 01 ")).toBe("BENUE-FLOOD-01");
    expect(normalizeEnvironmentalZoneCode("")).toBe("");
  });
});
