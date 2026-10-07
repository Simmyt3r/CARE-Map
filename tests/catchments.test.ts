import {describe,expect,it} from "vitest";
import {catchmentLevelLabel,isCatchmentLevel,normalizeCatchmentCode} from "../src/lib/catchments";

describe("catchment helpers",()=>{
  it("validates supported landscape levels",()=>{
    expect(isCatchmentLevel("watershed")).toBe(true);
    expect(isCatchmentLevel("subcatchment")).toBe(true);
    expect(isCatchmentLevel("county")).toBe(false);
  });

  it("creates readable landscape level labels",()=>{
    expect(catchmentLevelLabel("project_landscape")).toBe("Project Landscape");
    expect(catchmentLevelLabel("microcatchment")).toBe("Microcatchment");
  });

  it("normalizes optional catchment codes",()=>{
    expect(normalizeCatchmentCode(" Lower Benue 01 ")).toBe("LOWER-BENUE-01");
    expect(normalizeCatchmentCode("")).toBeNull();
  });
});
