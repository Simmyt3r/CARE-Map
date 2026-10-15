import {describe,expect,it} from "vitest";
import {publicResourceColumns,resourceKinds} from "../src/lib/resources";

describe("Anonymous CARE-Map resource exposure",()=>{
  it("declares only approved public columns for every resource kind",()=>{
    expect(Object.keys(publicResourceColumns).sort()).toEqual([...resourceKinds].sort());
    for(const kind of resourceKinds){
      const cols=publicResourceColumns[kind];
      expect(cols).toContain("id");
      expect(cols).toContain("name");
      expect(cols).toContain("lga_code");
      expect(cols.length).toBeGreaterThan(4);
      for(const disallowed of ["created_by","updated_by","gps_accuracy_m","captured_at",
        "capture_source","description","reporter_contact","submitted_by"]){
        expect(cols).not.toContain(disallowed);
      }
      expect(new Set(cols).size).toBe(cols.length);
    }
  });
});
