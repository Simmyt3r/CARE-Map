import {beforeEach,describe,expect,it,vi} from "vitest";
import {query} from "@/lib/db";
import {loadWorkspaceAccess} from "../src/lib/workspace-access";
import {ALL_WORKSPACE_IDS,DEFAULT_STAFF_WORKSPACES} from "../src/lib/workspaces";
import type {Session} from "../src/lib/auth";
vi.mock("@/lib/db",()=>({query:vi.fn()}));
const actor=(role:Session["role"]):Session=>({
 sub:"00000000-0000-4000-8000-000000000001",
 email:"staff@example.test",name:"Staff",role
});
describe("Database-backed workspace permissions",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("administrators retain everything without hitting user permission column",async()=>{
  expect(await loadWorkspaceAccess(actor("admin"))).toEqual(ALL_WORKSPACE_IDS);
  expect(query).not.toHaveBeenCalled();
 });
 it("community accounts have no staff access",async()=>{
  expect(await loadWorkspaceAccess(actor("registered_community"))).toEqual([]);
  expect(await loadWorkspaceAccess(null)).toEqual([]);
 });
 it("uses the current database permissions rather than JWT claims",async()=>{
  vi.mocked(query).mockResolvedValueOnce({rows:[{workspace_access:["gis","maps"]}]} as never);
  expect(await loadWorkspaceAccess(actor("staff"))).toEqual(["gis","maps"]);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("SELECT workspace_access FROM users"),[actor("staff").sub]
  );
 });
 it("fails closed when user record is missing or permission data is invalid",async()=>{
  vi.mocked(query).mockResolvedValueOnce({rows:[]} as never);
  expect(await loadWorkspaceAccess(actor("staff"))).toEqual([]);
  vi.mocked(query).mockResolvedValueOnce({rows:[{workspace_access:["admin"]}]} as never);
  expect(await loadWorkspaceAccess(actor("staff"))).toEqual([]);
 });
 it("permits narrow starter roles before migration 022 is applied",async()=>{
  vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error("column unavailable"),{code:"42703"}));
  expect(await loadWorkspaceAccess(actor("staff"))).toEqual(DEFAULT_STAFF_WORKSPACES);
 });
 it("rejects connection failures rather than giving all staff access",async()=>{
  vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error("database unavailable"),{code:"08006"}));
  await expect(loadWorkspaceAccess(actor("staff"))).rejects.toThrow("database unavailable");
 });
});
