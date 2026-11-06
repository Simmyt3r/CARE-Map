import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {getSession} from "@/lib/auth";
import {loadWorkspaceAccess} from "@/lib/workspace-access";
import {proxy} from "../src/proxy";
vi.mock("@/lib/auth",()=>({
 getSession:vi.fn(),
 isAdmin:(s:{role?:string}|null)=>s?.role==="admin",
 isStaff:(s:{role?:string}|null)=>s?.role==="staff"||s?.role==="admin"
}));
vi.mock("@/lib/workspace-access",()=>({loadWorkspaceAccess:vi.fn()}));
const actor={sub:"00000000-0000-4000-8000-000000000001",
 email:"demo@test.invalid",name:"Demo"};
const req=(path:string,method="GET")=>new NextRequest(
 "https://caremap.example.test"+path,{method}
);
describe("workspace access proxy",()=>{
 beforeEach(()=>{vi.clearAllMocks();});
 it("never blocks existing anonymous report submission and public resource map queries",async()=>{
  expect((await proxy(req("/api/reports","POST"))).status).toBe(200);
  expect((await proxy(req("/api/resources/boreholes"))).status).toBe(200);
  expect(getSession).not.toHaveBeenCalled();
 });
 it("blocks a staff user from both a hidden page and its direct API",async()=>{
  vi.mocked(getSession).mockResolvedValue({...actor,role:"staff"} as never);
  vi.mocked(loadWorkspaceAccess).mockResolvedValue(["field"] as never);
  const page=await proxy(req("/staff/remote-sensing"));
  expect(page.status).toBeGreaterThanOrEqual(300);
  expect(page.headers.get("location")).toContain("/staff?access=restricted");
  const api=await proxy(req("/api/remote-sensing/analyses","GET"));
  expect(api.status).toBe(403);
  expect(await api.text()).toContain("WORKSPACE_FORBIDDEN");
 });
 it("allows assigned staff and every administrator",async()=>{
  vi.mocked(getSession).mockResolvedValueOnce({...actor,role:"staff"} as never);
  vi.mocked(loadWorkspaceAccess).mockResolvedValueOnce(["gis"] as never);
  expect((await proxy(req("/api/gis/import","POST"))).status).toBe(200);
  vi.mocked(getSession).mockResolvedValueOnce({...actor,role:"admin"} as never);
  expect((await proxy(req("/staff/admin/migrations"))).status).toBe(200);
 });
 it("denies staff admin-only routes even with all interface grants",async()=>{
  vi.mocked(getSession).mockResolvedValue({...actor,role:"staff"} as never);
  expect((await proxy(req("/api/admin/users","GET"))).status).toBe(403);
  expect(loadWorkspaceAccess).not.toHaveBeenCalled();
 });
 it("rejects unauthenticated private endpoints without hiding public ones",async()=>{
  vi.mocked(getSession).mockResolvedValue(null);
  expect((await proxy(req("/api/crf/ledger"))).status).toBe(401);
  expect((await proxy(req("/api/reports","POST"))).status).toBe(200);
 });
});
