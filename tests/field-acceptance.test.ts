import {describe,expect,it} from "vitest";
import {acceptanceChecks,acceptanceFinalResult,canCompleteAcceptance,isAcceptanceCheckStatus} from "../src/lib/field-acceptance";

describe("field acceptance helpers",()=>{
  it("ships required online, GPS, offline and mobile workflow checks",()=>{
    const required=acceptanceChecks.filter(x=>x.required).map(x=>x.key);
    expect(required).toContain("device_gps_capture");
    expect(required).toContain("offline_report_queue");
    expect(required).toContain("reconnect_report_sync");
    expect(required).toContain("responsive_mobile_ui");
  });

  it("does not complete while a required check is not run",()=>{
    const checks=[
      {required:true,status:"pass" as const},
      {required:true,status:"not_run" as const}
    ];
    expect(canCompleteAcceptance(checks)).toBe(false);
    expect(acceptanceFinalResult(checks)).toBe("pending");
  });

  it("fails when any required check fails",()=>{
    expect(acceptanceFinalResult([
      {required:true,status:"pass"},
      {required:true,status:"fail"}
    ])).toBe("fail");
  });

  it("uses conditional for blocked or not-applicable required checks",()=>{
    expect(acceptanceFinalResult([
      {required:true,status:"pass"},
      {required:true,status:"blocked"}
    ])).toBe("conditional");
  });

  it("passes only when every required check passes",()=>{
    expect(acceptanceFinalResult([
      {required:true,status:"pass"},
      {required:true,status:"pass"},
      {required:false,status:"not_run"}
    ])).toBe("pass");
  });

  it("validates check status values",()=>{
    expect(isAcceptanceCheckStatus("blocked")).toBe(true);
    expect(isAcceptanceCheckStatus("maybe")).toBe(false);
  });
});
