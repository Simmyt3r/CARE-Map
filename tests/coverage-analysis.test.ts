import {describe,expect,it} from "vitest";
import {
  coverageScenarioLabel,
  isCoverageResourceType,
  isCoverageScenario,
  parseCoverageRadius
} from "../src/lib/coverage-analysis";

describe("coverage analysis helpers",()=>{
  it("validates supported point resource types",()=>{
    expect(isCoverageResourceType("borehole")).toBe(true);
    expect(isCoverageResourceType("asset")).toBe(true);
    expect(isCoverageResourceType("river")).toBe(false);
  });

  it("validates supported coverage scenarios",()=>{
    expect(isCoverageScenario("functional")).toBe(true);
    expect(isCoverageScenario("non_decommissioned")).toBe(true);
    expect(isCoverageScenario("all")).toBe(false);
  });

  it("accepts operational service radii from 100 m to 50 km",()=>{
    expect(parseCoverageRadius("100")).toBe(100);
    expect(parseCoverageRadius(2500.4)).toBe(2500);
    expect(parseCoverageRadius(50_000)).toBe(50_000);
    expect(parseCoverageRadius(99)).toBeNull();
    expect(parseCoverageRadius(50_001)).toBeNull();
    expect(parseCoverageRadius("not-a-number")).toBeNull();
  });

  it("labels scenarios without overstating what they mean",()=>{
    expect(coverageScenarioLabel("functional")).toBe("Functional only");
    expect(coverageScenarioLabel("non_decommissioned")).toBe("Mapped footprint (non-decommissioned)");
  });
});
