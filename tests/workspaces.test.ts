import {describe,expect,it} from "vitest";
import {
 ALL_WORKSPACE_IDS,DEFAULT_STAFF_WORKSPACES,WORKSPACES,
 parseWorkspaceAccess,requiredWorkspaceAccess,canAccessWorkspace,canAccessAnyWorkspace
} from "../src/lib/workspaces";

describe("CARE-Map staff workspace policies",()=>{
 it("registers one assignable interface per staff page",()=>{
  expect(new Set(ALL_WORKSPACE_IDS).size).toBe(WORKSPACES.length);
  for(const item of WORKSPACES){
   expect(requiredWorkspaceAccess(item.href)).toEqual([item.id]);
  }
  expect(requiredWorkspaceAccess("/staff")).toBeNull();
  expect(requiredWorkspaceAccess("/staff/admin")).toBe("admin");
  expect(requiredWorkspaceAccess("/staff/admin/migrations")).toBe("admin");
  expect(requiredWorkspaceAccess("/staff/infrastructure")).toBe("admin");
  expect(requiredWorkspaceAccess("/api/admin/users")).toBe("admin");
 });
 it("resolves long matching nested routes before parent satellite routes",()=>{
  expect(requiredWorkspaceAccess("/staff/remote-sensing/monitoring")).toEqual(["monitoring"]);
  expect(requiredWorkspaceAccess("/staff/remote-sensing/monitoring/new")).toEqual(["monitoring"]);
  expect(requiredWorkspaceAccess("/staff/remote-sensing")).toEqual(["satellite"]);
  expect(requiredWorkspaceAccess("/api/remote-sensing/monitors/abc/run")).toEqual(["monitoring","satellite"]);
  expect(requiredWorkspaceAccess("/api/remote-sensing/alerts/abc/acknowledge")).toEqual(["monitoring","satellite","operations"]);
 });
 it("keeps public and personal APIs public, but gates private methods",()=>{
  expect(requiredWorkspaceAccess("/api/reports","POST")).toBeNull();
  expect(requiredWorkspaceAccess("/api/reports","GET")).toEqual(["reports"]);
  expect(requiredWorkspaceAccess("/api/reports/mine","GET")).toBeNull();
  expect(requiredWorkspaceAccess("/api/reports/abc/photos","GET")).toEqual(["reports"]);
  expect(requiredWorkspaceAccess("/api/resources/boreholes","GET")).toBeNull();
  expect(requiredWorkspaceAccess("/api/resources/boreholes","POST")).toEqual(["field"]);
  expect(requiredWorkspaceAccess("/api/resources/boreholes/abc","PATCH")).toEqual(["field"]);
  expect(requiredWorkspaceAccess("/api/gis/lga-boundaries","GET")).toBeNull();
  expect(requiredWorkspaceAccess("/api/gis/lga-boundaries","POST")).toEqual(["gis"]);
  expect(requiredWorkspaceAccess("/api/gis/analysis/context")).toEqual(["analysis"]);
  expect(requiredWorkspaceAccess("/api/gis/import","POST")).toEqual(["gis"]);
  expect(requiredWorkspaceAccess("/api/gis/export")).toEqual(["gis","maps"]);
  expect(requiredWorkspaceAccess("/api/crf/access")).toBe("admin");
  expect(requiredWorkspaceAccess("/api/crf/ledger")).toEqual(["finance"]);
  expect(requiredWorkspaceAccess("/api/extension","POST")).toEqual(["extension"]);
  expect(requiredWorkspaceAccess("/api/field-acceptance")).toEqual(["quality"]);
  expect(requiredWorkspaceAccess("/api/dashboard/export")).toEqual(["field","gis","maps"]);
  expect(requiredWorkspaceAccess("/api/predictions/priority-rankings")).toEqual(["operations","analysis"]);
  expect(requiredWorkspaceAccess("/api/health")).toBeNull();
 });
 it("administrators always access all interfaces without special grants",()=>{
  for(const id of ALL_WORKSPACE_IDS)expect(canAccessWorkspace("admin",[],id)).toBe(true);
  expect(canAccessAnyWorkspace("admin",[],["finance"])).toBe(true);
  expect(canAccessWorkspace("staff",["field"],"finance")).toBe(false);
  expect(canAccessWorkspace("registered_community",ALL_WORKSPACE_IDS,"reports")).toBe(false);
 });
 it("parses only recognized, nonempty staff assignments",()=>{
  expect(parseWorkspaceAccess(["reports","field","reports"])).toEqual(DEFAULT_STAFF_WORKSPACES);
  expect(parseWorkspaceAccess(["finance"])).toEqual(["finance"]);
  expect(parseWorkspaceAccess([])).toBeNull();
  expect(parseWorkspaceAccess(["finance","root"])).toBeNull();
  expect(parseWorkspaceAccess("finance")).toBeNull();
 });
});
