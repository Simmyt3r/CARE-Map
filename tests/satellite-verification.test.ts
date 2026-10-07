import {describe,expect,it} from "vitest";
import {fieldVerificationClosureError,fieldVerificationDueAt} from "../src/lib/satellite-verification";

describe("satellite field verification policy",()=>{
  it("sets urgency-based default deadlines",()=>{
    const now=new Date("2026-10-07T00:00:00Z");
    expect(fieldVerificationDueAt("critical",now).toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(fieldVerificationDueAt("high",now).toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(fieldVerificationDueAt("medium",now).toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });

  it("does not impose satellite evidence rules on ordinary reports",()=>{
    expect(fieldVerificationClosureError({
      origin:"community",status:"resolved",note:null,evidenceCount:0
    })).toBeNull();
  });

  it("requires a meaningful closure note for satellite verification",()=>{
    expect(fieldVerificationClosureError({
      origin:"satellite_alert",status:"resolved",note:"done",evidenceCount:1
    })).toMatch(/status note/i);
    expect(fieldVerificationClosureError({
      origin:"satellite_alert",status:"rejected",note:"not valid",evidenceCount:0
    })).toMatch(/status note/i);
  });

  it("requires photo evidence before resolving a satellite verification",()=>{
    expect(fieldVerificationClosureError({
      origin:"satellite_alert",status:"resolved",note:"Vegetation loss confirmed on site.",evidenceCount:0
    })).toMatch(/evidence photo/i);
    expect(fieldVerificationClosureError({
      origin:"satellite_alert",status:"resolved",note:"Vegetation loss confirmed on site.",evidenceCount:2
    })).toBeNull();
  });

  it("allows rejection with a clear reason even without evidence photos",()=>{
    expect(fieldVerificationClosureError({
      origin:"satellite_alert",status:"rejected",note:"Satellite signal was caused by cloud contamination.",evidenceCount:0
    })).toBeNull();
  });
});
