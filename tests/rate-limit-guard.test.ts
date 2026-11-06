import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {query} from "@/lib/db";
import {rateLimitGuard} from "../src/lib/http";
vi.mock("@/lib/db",()=>({query:vi.fn()}));
const before=process.env.SESSION_SECRET;
describe("shared limiter fail-closed behavior",()=>{
  beforeEach(()=>{process.env.SESSION_SECRET="test-shared-rate-limit-secret-more-than-32";vi.clearAllMocks();});
  afterEach(()=>{if(before===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=before;vi.restoreAllMocks();});
  it("returns 503 rather than permitting requests if shared storage fails",async()=>{
    const logged=vi.spyOn(console,"error").mockImplementation(()=>{});
    vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error("private schema name"),{code:"42P01"}));
    const response=await rateLimitGuard("login:example",3,60_000,"Too many attempts");
    expect(response?.status).toBe(503);
    const text=await response?.text();
    expect(text).toContain("RATE_LIMIT_UNAVAILABLE");
    expect(text).not.toContain("private schema name");
    expect(logged).toHaveBeenCalledWith("Shared rate limiter unavailable",{code:"42P01"});
  });
  it("returns 429 when a shared bucket exceeds the threshold",async()=>{
    vi.mocked(query).mockResolvedValueOnce({rows:[{current_hits:4}]} as never);
    const response=await rateLimitGuard("login:example",3,60_000,"Too many attempts");
    expect(response?.status).toBe(429);
  });
});
