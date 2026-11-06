import {describe,expect,it} from "vitest";
import {parseDeploymentProfile} from "../src/lib/deployment-profile";

describe("CARE-Map regional deployment configuration",()=>{
  it("starts with neutral global branding and a world-scale map",()=>{
    expect(parseDeploymentProfile()).toEqual({
      regionName:"Global",stateName:"Global",mapCenter:[0,0],mapZoom:2
    });
  });
  it("requires approved source data and reviewed map center to claim a region",()=>{
    expect(()=>parseDeploymentProfile({regionName:"Example Region"})).toThrow(/dataset acceptance/);
    expect(()=>parseDeploymentProfile({
      regionName:"Example Region",regionDataApproved:"true"
    })).toThrow(/map center/);
    expect(parseDeploymentProfile({
      regionName:"Example Region",regionDataApproved:"true",
      centerLongitude:"12.4",centerLatitude:"-1.8",zoom:"7"
    })).toMatchObject({regionName:"Example Region",mapCenter:[12.4,-1.8],mapZoom:7});
  });
  it("supports legacy environment names without privileging any location",()=>{
    expect(parseDeploymentProfile({
      stateName:"Example State",stateDataApproved:"true",
      centerLongitude:"8.53",centerLatitude:"8.54"
    }).regionName).toBe("Example State");
  });
  it("rejects invalid region names, map longitude, latitude or zoom",()=>{
    expect(()=>parseDeploymentProfile({regionName:"<script>"})).toThrow(/region name/);
    expect(()=>parseDeploymentProfile({centerLongitude:"NaN"})).toThrow(/map center/);
    expect(()=>parseDeploymentProfile({centerLatitude:"95"})).toThrow(/map center/);
    expect(()=>parseDeploymentProfile({zoom:"20"})).toThrow(/map center/);
  });
});
