import {describe,expect,it} from "vitest";
import {changeLevel,dateWindow,normalizeAoi} from "../src/lib/remote-sensing";

describe("remote sensing helpers",()=>{
  it("builds a deterministic UTC observation window",()=>{
    expect(dateWindow("2026-01-10",7)).toEqual({
      from:"2026-01-10T00:00:00.000Z",
      to:"2026-01-17T00:00:00.000Z"
    });
  });

  it("validates polygon AOIs",()=>{
    const polygon={type:"Polygon",coordinates:[[[8.5,7.7],[8.6,7.7],[8.6,7.8],[8.5,7.7]]]};
    expect(normalizeAoi(polygon)).toEqual(polygon);
    expect(()=>normalizeAoi({type:"Point",coordinates:[8.5,7.7]})).toThrow();
  });

  it("classifies vegetation loss severity",()=>{
    expect(changeLevel(null)).toBe("low");
    expect(changeLevel(-3)).toBe("low");
    expect(changeLevel(-9)).toBe("medium");
    expect(changeLevel(-18)).toBe("high");
    expect(changeLevel(-30)).toBe("critical");
  });
});
