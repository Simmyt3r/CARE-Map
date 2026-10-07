import {describe,expect,it} from "vitest";
import {readinessScore,readinessSummary,type ReadinessItem} from "../src/lib/readiness";

const items:ReadinessItem[]=[
  {id:"db",label:"DB",category:"database",state:"ready",required:true,detail:"",action:""},
  {id:"secret",label:"Secret",category:"security",state:"warning",required:true,detail:"",action:""},
  {id:"data",label:"Data",category:"data",state:"blocked",required:true,detail:"",action:""},
  {id:"optional",label:"Optional",category:"operations",state:"ready",required:false,detail:"",action:""}
];

describe("production readiness scoring",()=>{
  it("scores only required gates, with warnings worth half credit",()=>{
    expect(readinessScore(items)).toBe(50);
  });

  it("summarizes blockers, warnings, ready and optional gates",()=>{
    expect(readinessSummary(items)).toEqual({
      score:50,required:3,ready:1,warnings:1,blockers:1,optionalReady:1,optionalTotal:1
    });
  });

  it("returns 100 when there are no required gates",()=>{
    expect(readinessScore(items.map(x=>({...x,required:false})))).toBe(100);
  });
});
