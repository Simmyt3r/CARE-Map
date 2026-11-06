import {describe,expect,it} from "vitest";
import {parseDeploymentProfile} from "../src/lib/deployment-profile";
import {isWithinNigeriaExtent,NIGERIAN_STATES,normalizeNigerianState}
  from "../src/lib/nigeria-geography";

describe("CARE-Map Nigeria-only deployment configuration",()=>{
  it("defaults to Nigeria-wide branding and a national-scale map",()=>{
    expect(parseDeploymentProfile()).toMatchObject({
      countryName:"Nigeria",countryCode:"NG",regionName:"Nigeria",
      stateName:"Nigeria",mapCenter:[8.6753,9.0820],mapZoom:5
    });
    expect(parseDeploymentProfile().mapBounds).toHaveLength(2);
  });
  it("accepts only verified Nigeria state/FCT deployments",()=>{
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(normalizeNigerianState("Abuja")).toBe("Federal Capital Territory");
    expect(()=>parseDeploymentProfile({regionName:"Ghana",regionDataApproved:"true"})).toThrow(/Nigeria/);
    expect(()=>parseDeploymentProfile({regionName:"Global"})).toThrow(/Nigeria/);
    expect(()=>parseDeploymentProfile({regionName:"Benue"})).toThrow(/approved/);
    expect(()=>parseDeploymentProfile({regionName:"Benue",regionDataApproved:"true"})).toThrow(/map centre/);
    expect(parseDeploymentProfile({
      regionName:"Benue State",regionDataApproved:"true",
      centerLongitude:"8.53",centerLatitude:"7.73"
    })).toMatchObject({regionName:"Nigeria",stateName:"Benue",mapCenter:[8.53,7.73]});
  });
  it("rejects invalid map coordinates or remote country settings",()=>{
    expect(()=>parseDeploymentProfile({centerLongitude:"0"})).toThrow(/Nigeria/);
    expect(()=>parseDeploymentProfile({centerLatitude:"-5"})).toThrow(/Nigeria/);
    expect(()=>parseDeploymentProfile({zoom:"25"})).toThrow(/zoom/);
    expect(isWithinNigeriaExtent(9.08,8.68)).toBe(true);
    expect(isWithinNigeriaExtent(51.5,-0.12)).toBe(false);
  });
  it("accepts old verified Nigerian state environment names",()=>{
    expect(parseDeploymentProfile({
      stateName:"Lagos",stateDataApproved:"true",
      centerLongitude:"3.39",centerLatitude:"6.52"
    }).stateName).toBe("Lagos");
  });
});
