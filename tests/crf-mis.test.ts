import {describe,expect,it} from "vitest";
import {assessGroup,canCrf,crfIndicators,CRF_POLICY,flatServiceCharge,trancheAmount} from "../src/lib/crf";

describe("Benue CRF policy and governance",()=>{
 it("implements 15 members and ≥40% female membership",()=>{
  const group=Array.from({length:15},(_,i)=>({sex:i<6?"female":"male",participation_verified:true}));
  expect(assessGroup(group)).toMatchObject({ready:true,count:15,female:6,femalePercent:40});
  expect(assessGroup(group.slice(0,14)).ready).toBe(false);
  expect(assessGroup(group.map((x,i)=>i===0?{...x,participation_verified:false}:x)).ready).toBe(false);
  expect(assessGroup(group.map((x,i)=>i===5?{...x,sex:"male"}:x)).ready).toBe(false);
  expect(CRF_POLICY).toMatchObject({recoveryMinimum:75,par60Maximum:25,womenFundMinimum:undefined});
 });
 it("calculates the approved flat service charge and exact 70/30 tranches",()=>{
  expect(flatServiceCharge(3)).toBe(50000);
  expect(flatServiceCharge(6)).toBe(75000);
  expect(flatServiceCharge(12)).toBe(100000);
  const first=trancheAmount(4500000,1),second=trancheAmount(4500000,2);
  expect(first).toBe(3150000);
  expect(second).toBe(1350000);
  expect(first+second).toBe(4500000);
 });
 it("never fabricates performance when no amounts are due or outstanding",()=>{
  const empty=crfIndicators({dueInPeriod:0,recoveredInPeriod:0,outstandingTotal:0,
   outstandingAtRisk60:0,verifiedDisbursedTotal:0,womenLedDisbursed:0});
  expect(empty.recoveryPercent).toBeNull();
  expect(empty.par60Percent).toBeNull();
  expect(empty.womenFundPercent).toBeNull();
  const active=crfIndicators({dueInPeriod:100,recoveredInPeriod:75,outstandingTotal:200,
   outstandingAtRisk60:50,verifiedDisbursedTotal:500,womenLedDisbursed:150});
  expect(active).toMatchObject({recoveryPercent:75,par60Percent:25,womenFundPercent:30});
 });
 it("keeps GIS roles away from CRF finance verification",()=>{
  expect(canCrf(["gis_officer"],"view")).toBe(true);
  expect(canCrf(["gis_officer"],"finance")).toBe(false);
  expect(canCrf(["desk_officer"],"verify")).toBe(false);
  expect(canCrf(["internal_auditor"],"verify")).toBe(true);
  expect(canCrf(["management"],"report")).toBe(true);
 });
});
