import {describe,expect,it} from "vitest";
import {assessNdviQuality,changeLevel,dateWindow,normalizeAoi} from "../src/lib/remote-sensing";

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

describe("Satellite reliability",()=>{
  const valid={
    meanNdvi:0.45,vegetationFraction:0.7,clearFraction:0.82,
    vegetationHa:70,raw:null
  };
  it("flags cloud-obscured observation dates before publication",()=>{
    expect(assessNdviQuality(valid,{...valid,clearFraction:0.38}).publishable).toBe(false);
    expect(assessNdviQuality(valid,{...valid,meanNdvi:null}).issues).toHaveLength(1);
    expect(assessNdviQuality(valid,valid).publishable).toBe(true);
  });
  it("rejects invalid AOIs, inverted coordinate precision and unclosed rings",()=>{
    expect(()=>normalizeAoi({type:"Polygon",coordinates:[[[8,7],[8.5,7],[8.5,7.5]]]})).toThrow();
    expect(()=>normalizeAoi({type:"Polygon",coordinates:[[[181,7],[8.5,7],[8.5,7.5],[181,7]]]})).toThrow();
    expect(()=>normalizeAoi({type:"Polygon",coordinates:[[[8,7],[11,7],[11,7.5],[8,7]]]})).toThrow();
  });
  it("accepts PostgreSQL Date values and rejects impossible dates",()=>{
    expect(dateWindow(new Date("2026-10-01T00:00:00Z"),7).from).toBe("2026-10-01T00:00:00.000Z");
    expect(()=>dateWindow("2026-02-31",7)).toThrow();
  });
});
