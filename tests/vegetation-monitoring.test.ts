import {describe,expect,it} from "vitest";
import {monitorDue,shouldRaiseVegetationAlert} from "../src/lib/vegetation-monitoring";

describe("vegetation monitoring rules",()=>{
  it("marks a monitor due at or after next_due_at",()=>{
    const now=new Date("2026-10-07T03:00:00Z");
    expect(monitorDue(now,"2026-10-07T03:00:00Z")).toBe(true);
    expect(monitorDue(now,"2026-10-08T03:00:00Z")).toBe(false);
  });

  it("requires adequate clear coverage before alerting",()=>{
    expect(shouldRaiseVegetationAlert(-18,0.75,0.60,10)).toBe(true);
    expect(shouldRaiseVegetationAlert(-18,0.45,0.60,10)).toBe(false);
  });

  it("only alerts once vegetation loss crosses the configured threshold",()=>{
    expect(shouldRaiseVegetationAlert(-9,0.8,0.6,10)).toBe(false);
    expect(shouldRaiseVegetationAlert(-10,0.8,0.6,10)).toBe(true);
    expect(shouldRaiseVegetationAlert(4,0.8,0.6,10)).toBe(false);
  });
});
