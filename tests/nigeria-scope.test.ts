import {describe,expect,it} from "vitest";
import {isWithinNigeriaExtent,assertNigeriaGeometry,NIGERIAN_STATES} from "../src/lib/nigeria-geography";
import {parsePoint} from "../src/lib/spatial-context";
import {reportSchema} from "../src/lib/validators";

const report={
 type:"problem_report",description:"A drainage obstruction is visible near the main road.",
 privacyAcknowledged:true,privacyNoticeVersion:"2026-11-06"
};
describe("Nigeria-only climate platform boundary screening",()=>{
  it("covers the Nigerian national extent without pretending it is a surveyed border",()=>{
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(isWithinNigeriaExtent(6.45,3.39)).toBe(true);
    expect(isWithinNigeriaExtent(9.08,7.49)).toBe(true);
    expect(isWithinNigeriaExtent(51.5,-0.12)).toBe(false);
    expect(isWithinNigeriaExtent(5.55,-0.2)).toBe(false);
  });
  it("screens public reports with valid Nigerian locations",()=>{
    expect(reportSchema.safeParse({...report,latitude:6.45,longitude:3.39}).success).toBe(true);
    const denied=reportSchema.safeParse({...report,latitude:51.5,longitude:-0.12});
    expect(denied.success).toBe(false);
    if(!denied.success)expect(denied.error.issues.some(x=>x.message.includes("Nigeria"))).toBe(true);
  });
  it("screens spatial analysis points without DB access",()=>{
    expect(parsePoint(7.72,8.51)).toEqual({type:"Point",coordinates:[8.51,7.72]});
    expect(()=>parsePoint(48.8,2.3)).toThrow(/Nigeria/);
  });
  it("screens all vertices in imported lines, multipolygons and features",()=>{
    expect(()=>assertNigeriaGeometry({type:"LineString",coordinates:[[8,7],[9,7]]})).not.toThrow();
    expect(()=>assertNigeriaGeometry({
      type:"MultiPolygon",coordinates:[[[[8,7],[8.2,7],[8.2,7.3],[8,7]]]]
    })).not.toThrow();
    expect(()=>assertNigeriaGeometry({type:"Polygon",coordinates:[[[8,7],[8.2,7],[0,0],[8,7]]]})).toThrow(/Nigeria/);
  });
});
