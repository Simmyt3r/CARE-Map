import {describe,expect,it} from "vitest";
import {parseDeploymentProfile} from "../src/lib/deployment-profile";

describe("CARE-Map jurisdiction configuration",()=>{
  it("preserves approved Benue deployment defaults",()=>{
    expect(parseDeploymentProfile()).toEqual({
      stateName:"Benue",defaultBenue:true,mapCenter:[8.7,7.35],mapZoom:6.5
    });
  });
  it("requires explicit data acceptance and map center for another state",()=>{
    expect(()=>parseDeploymentProfile({stateName:"Nasarawa"})).toThrow(/dataset acceptance/);
    expect(()=>parseDeploymentProfile({
      stateName:"Nasarawa",stateDataApproved:"true"
    })).toThrow(/map center/);
    expect(parseDeploymentProfile({
      stateName:"Nasarawa",stateDataApproved:"true",
      centerLongitude:"8.53",centerLatitude:"8.54",zoom:"7"
    })).toMatchObject({
      stateName:"Nasarawa",defaultBenue:false,mapCenter:[8.53,8.54],mapZoom:7
    });
  });
  it("rejects invalid state names, map longitude, latitude or zoom",()=>{
    expect(()=>parseDeploymentProfile({stateName:"<script>"})).toThrow(/state name/);
    expect(()=>parseDeploymentProfile({centerLongitude:"NaN"})).toThrow(/map center/);
    expect(()=>parseDeploymentProfile({centerLatitude:"95"})).toThrow(/map center/);
    expect(()=>parseDeploymentProfile({zoom:"20"})).toThrow(/map center/);
  });
});
