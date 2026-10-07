import {describe,expect,it} from "vitest";
import {
  isSettlementType,
  parseOptionalGpsAccuracy,
  parseOptionalPopulation,
  parseOptionalPopulationYear,
  parseSettlementAccessRadius,
  populationProvenanceError
} from "../src/lib/settlements";

describe("settlement helpers",()=>{
  it("validates settlement types",()=>{
    expect(isSettlementType("village")).toBe(true);
    expect(isSettlementType("town")).toBe(true);
    expect(isSettlementType("planet")).toBe(false);
  });

  it("parses optional population without inventing missing values",()=>{
    expect(parseOptionalPopulation("")).toBeNull();
    expect(parseOptionalPopulation("1200")).toBe(1200);
    expect(parseOptionalPopulation("-2")).toBeUndefined();
    expect(parseOptionalPopulation("12.5")).toBeUndefined();
  });

  it("validates population year and GPS accuracy",()=>{
    expect(parseOptionalPopulationYear("2024")).toBe(2024);
    expect(parseOptionalPopulationYear("")).toBeNull();
    expect(parseOptionalPopulationYear("1800")).toBeUndefined();
    expect(parseOptionalGpsAccuracy("4.5")).toBe(4.5);
    expect(parseOptionalGpsAccuracy("-1")).toBeUndefined();
  });

  it("requires provenance when population is supplied",()=>{
    expect(populationProvenanceError(500,null,2024)).toMatch(/source/i);
    expect(populationProvenanceError(null,null,2024)).toMatch(/without population/i);
    expect(populationProvenanceError(500,"NPC estimate",2024)).toBeNull();
    expect(populationProvenanceError(null,null,null)).toBeNull();
  });

  it("validates straight-line access thresholds",()=>{
    expect(parseSettlementAccessRadius("100")).toBe(100);
    expect(parseSettlementAccessRadius(5000.3)).toBe(5000);
    expect(parseSettlementAccessRadius(50_000)).toBe(50_000);
    expect(parseSettlementAccessRadius(99)).toBeNull();
  });
});
