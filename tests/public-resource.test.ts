import {describe,expect,it} from "vitest";
import {isPublicKind,isPublicResourceId,singularEntity} from "../src/lib/public-resource";

describe("public resource routing",()=>{
  it("accepts supported public resource kinds",()=>{
    expect(isPublicKind("boreholes")).toBe(true);
    expect(isPublicKind("forest-sites")).toBe(true);
    expect(isPublicKind("users")).toBe(false);
  });

  it("validates UUID resource ids",()=>{
    expect(isPublicResourceId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isPublicResourceId("not-a-resource-id")).toBe(false);
  });

  it("maps collection kinds to entity types",()=>{
    expect(singularEntity("boreholes")).toBe("borehole");
    expect(singularEntity("forest-sites")).toBe("forest_site");
  });
});
