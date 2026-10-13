import {describe,expect,it} from "vitest";
import {bestGpsSample,describeGpsError,usableGpsSample} from "../src/lib/field-gps";
import {validateFieldPoint} from "../src/lib/location-quality";
import {reportSchema} from "../src/lib/validators";

const now=Date.parse("2026-10-13T15:00:00Z");
function sample(latitude:number,longitude:number,accuracy:number,timestamp=now){
  return {coords:{latitude,longitude,accuracy},timestamp} as unknown as Pick<GeolocationPosition,"coords"|"timestamp">;
}
function field(overrides:Record<string,unknown>={}){
  return {latitude:7.73,longitude:8.53,gpsAccuracy:12.3,
    captureSource:"device_gps",capturedAt:new Date().toISOString(),...overrides};
}
function report(overrides:Record<string,unknown>={}){
  return {type:"problem_report",description:"A drainage channel is blocked and needs inspection.",
    latitude:7.73,longitude:8.53,privacyAcknowledged:true,privacyNoticeVersion:"2026-01",
    captureSource:"manual",gpsAccuracy:null,capturedAt:null,...overrides};
}

describe("GPS acquisition quality",()=>{
  it("accepts recent WGS84 geolocation readings with positive reported accuracy",()=>{
    const fix=usableGpsSample(sample(7.733,8.53,9.4),now);
    expect(fix).toMatchObject({latitude:7.733,longitude:8.53,accuracyMeters:9.4});
  });
  it("rejects browser-cached fixes, future readings, null island and impossible samples",()=>{
    expect(usableGpsSample(sample(7.73,8.53,4,now-20_000),now)).toBeNull();
    expect(usableGpsSample(sample(7.73,8.53,4,now+10_000),now)).toBeNull();
    expect(usableGpsSample(sample(0,0,4),now)).toBeNull();
    expect(usableGpsSample(sample(7.73,8.53,0),now)).toBeNull();
    expect(usableGpsSample(sample(92,8.53,6),now)).toBeNull();
  });
  it("preserves the best accuracy and explains blocked permission",()=>{
    const good=usableGpsSample(sample(7.73,8.53,8),now)!;
    const poor=usableGpsSample(sample(7.7302,8.5301,50),now)!;
    expect(bestGpsSample(null,poor)).toBe(poor);
    expect(bestGpsSample(good,poor)).toBe(good);
    expect(describeGpsError(1)).toContain("denied");
  });
});

describe("Location metadata integrity",()=>{
  it("accepts a recent device GPS fix",()=>{
    expect(validateFieldPoint(field())).toMatchObject({captureSource:"device_gps",gpsAccuracy:12.3});
  });
  it("prevents edited coordinates from inheriting device-GPS accuracy",()=>{
    expect(()=>validateFieldPoint(field({
      captureSource:"manual",capturedAt:new Date().toISOString(),gpsAccuracy:6
    }))).toThrow(/Manually entered/);
    expect(validateFieldPoint(field({captureSource:"manual",capturedAt:null,gpsAccuracy:null})).gpsAccuracy).toBeNull();
  });
  it("rejects outdated, future and zero-accuracy device GPS fixes",()=>{
    expect(()=>validateFieldPoint(field({capturedAt:new Date(Date.now()-16*60_000).toISOString()}))).toThrow(/older than/);
    expect(()=>validateFieldPoint(field({capturedAt:new Date(Date.now()+90_000).toISOString()}))).toThrow(/past timestamp/);
    expect(()=>validateFieldPoint(field({gpsAccuracy:0}))).toThrow(/accuracy/);
  });
  it("does not coerce missing coordinate strings into 0,0",()=>{
    expect(()=>validateFieldPoint(field({latitude:""}))).toThrow(/required/);
    expect(()=>validateFieldPoint(field({longitude:"NaN"}))).toThrow(/finite/);
  });
});

describe("Community report GPS provenance",()=>{
  it("accepts clearly labelled manual coordinates without GPS metadata",()=>{
    expect(reportSchema.safeParse(report()).success).toBe(true);
  });
  it("rejects forged manual GPS accuracy or undocumented GPS capture",()=>{
    expect(reportSchema.safeParse(report({gpsAccuracy:6})).success).toBe(false);
    expect(reportSchema.safeParse(report({captureSource:"device_gps",gpsAccuracy:6})).success).toBe(false);
  });
  it("retains valid older capture time for offline queued report submissions",()=>{
    const date="2026-10-09T08:20:00.000Z";
    expect(reportSchema.safeParse(report({captureSource:"device_gps",gpsAccuracy:24,capturedAt:date})).success).toBe(true);
  });
  it("rejects null island and future-dated coordinates",()=>{
    expect(reportSchema.safeParse(report({latitude:0,longitude:0})).success).toBe(false);
    expect(reportSchema.safeParse(report({captureSource:"device_gps",gpsAccuracy:24,capturedAt:new Date(Date.now()+90_000).toISOString()})).success).toBe(false);
  });
});
