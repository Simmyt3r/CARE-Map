import {describe,expect,it} from "vitest";
import {parseRiverCorridorRadius,riverCorridorScopeLabel} from "../src/lib/river-corridor";

describe("river corridor helpers",()=>{
  it("accepts corridor distances from 50 m to 20 km",()=>{
    expect(parseRiverCorridorRadius("50")).toBe(50);
    expect(parseRiverCorridorRadius(750.4)).toBe(750);
    expect(parseRiverCorridorRadius(20_000)).toBe(20_000);
    expect(parseRiverCorridorRadius(49)).toBeNull();
    expect(parseRiverCorridorRadius(20_001)).toBeNull();
  });

  it("labels whole-LGA and specific-river scopes",()=>{
    expect(riverCorridorScopeLabel()).toMatch(/All verified rivers/i);
    expect(riverCorridorScopeLabel(" River Benue ")).toBe("River Benue");
  });
});
