import {describe,expect,it} from "vitest";
import {comparisonWindowError,observationDate,observationWindowEnd,
  observationWindowError} from "../src/lib/sentinel-date-quality";
import {NoSentinelObservationError} from "../src/lib/remote-sensing";

const reference=new Date("2026-10-14T07:46:00Z");

describe("Sentinel-2 completed acquisition windows",()=>{
  it("rejects the incomplete 30-day October 2026 comparison",()=>{
    expect(observationWindowError("2026-10-14",30,reference)).toContain("2026-11-13");
    expect(comparisonWindowError("2025-10-14","2026-10-14",30,reference))
      .toContain("Comparison:");
    expect(comparisonWindowError("2025-10-14","2026-10-14",30,reference))
      .toContain("2026-09-14");
  });
  it("accepts two completed January 14-day test periods",()=>{
    expect(comparisonWindowError("2025-01-15","2026-01-15",14,reference)).toBeNull();
    expect(observationWindowEnd("2026-01-15",14).toISOString())
      .toBe("2026-01-29T00:00:00.000Z");
  });
  it("accepts PostgreSQL DATE objects and rejects malformed/impossible dates",()=>{
    expect(observationDate(new Date("2025-03-01T00:00:00Z"))).toBe("2025-03-01");
    expect(observationWindowError("2026-02-30",7,reference)).toMatch(/valid observation date/);
    expect(observationWindowError("2026-02-01",31,reference)).toMatch(/between 1 and 30/);
  });
  it("disallows comparison dates before or equal to the baseline",()=>{
    expect(comparisonWindowError("2026-01-10","2026-01-10",7,reference)).toMatch(/later/);
    expect(comparisonWindowError("2026-01-10","2025-01-10",7,reference)).toMatch(/later/);
  });
  it("handles cutoff at the last fully completed UTC day",()=>{
    expect(observationWindowError("2026-10-06",8,reference)).toBeNull();
    expect(observationWindowError("2026-10-07",8,reference)).toMatch(/not a completed/);
  });
  it("distinguishes missing observation from a provider failure",()=>{
    const err=new NoSentinelObservationError("2025-10-14","2025-11-13");
    expect(err.name).toBe("NoSentinelObservationError");
    expect(err.message).toContain("No usable Sentinel-2 observation");
    expect(err.message).toContain("earlier completed");
  });
});
