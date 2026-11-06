import {beforeEach,describe,expect,it,vi} from "vitest";
import {pool} from "@/lib/db";
import {POST} from "../src/app/api/reports/route";

vi.mock("@/lib/db",()=>({pool:vi.fn(),query:vi.fn()}));
vi.mock("@/lib/auth",()=>({getSession:vi.fn(async()=>null),isStaff:vi.fn(()=>false)}));
vi.mock("@/lib/http",async(importOriginal)=>{
  const original=await importOriginal<typeof import("../src/lib/http")>();
  return {...original,rateLimitGuard:vi.fn(async()=>null)};
});

const report={
  type:"problem_report",description:"A drainage channel is blocked near the road.",
  latitude:7.72,longitude:8.51,privacyAcknowledged:true,
  privacyNoticeVersion:"2026-11-06"
};
describe("anonymous report error boundaries",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it("never returns a database exception or connection details to the public",async()=>{
    const leak="secret=postgres://private-host/db internal foreign key violation";
    const query=vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(
      Object.assign(new Error(leak),{code:"23503"})).mockResolvedValueOnce({});
    const release=vi.fn();
    vi.mocked(pool).mockReturnValue({connect:vi.fn(async()=>({query,release}))} as never);
    const logged=vi.spyOn(console,"error").mockImplementation(()=>{});
    const response=await POST(new Request("https://example.test/api/reports",{
      method:"POST",headers:{"content-type":"application/json","x-forwarded-for":"198.51.100.9"},
      body:JSON.stringify(report)
    }));
    const text=await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain("REPORT_SUBMISSION_FAILED");
    expect(text).not.toContain(leak);
    expect(text).not.toContain("private-host");
    expect(release).toHaveBeenCalledOnce();
    expect(query.mock.calls.map(call=>call[0])).toContain("ROLLBACK");
    expect(logged).toHaveBeenCalledWith("Report submission failed",{code:"23503"});
    logged.mockRestore();
  });
});
