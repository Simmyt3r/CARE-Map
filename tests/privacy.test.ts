import {describe,expect,it} from "vitest";
import {
  breachHoursRemaining,
  dataSubjectRequestLabel,
  isDataSubjectRequestStatus,
  isDataSubjectRequestType,
  privacyReference,
  PRIVACY_NOTICE_VERSION
} from "../src/lib/privacy";

describe("privacy governance helpers",()=>{
  it("validates supported data-subject request types and statuses",()=>{
    expect(isDataSubjectRequestType("access")).toBe(true);
    expect(isDataSubjectRequestType("delete-everything")).toBe(false);
    expect(isDataSubjectRequestStatus("in_review")).toBe(true);
    expect(isDataSubjectRequestStatus("waiting_forever")).toBe(false);
  });

  it("creates readable request labels",()=>{
    expect(dataSubjectRequestLabel("withdraw_consent")).toBe("Withdraw Consent");
  });

  it("uses an auditable date-formatted privacy notice version",()=>{
    expect(PRIVACY_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("creates non-sequential privacy references with a 12-hex suffix",()=>{
    expect(privacyReference()).toMatch(/^PRV-\d{8}-[A-F0-9]{12}$/);
  });

  it("tracks the 72-hour breach notification window",()=>{
    const detected=new Date("2026-10-07T10:00:00Z");
    expect(breachHoursRemaining(detected,new Date("2026-10-08T10:00:00Z"))).toBe(48);
    expect(breachHoursRemaining(detected,new Date("2026-10-12T10:00:00Z"))).toBe(0);
  });
});
