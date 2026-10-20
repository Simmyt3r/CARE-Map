import {describe,expect,it} from "vitest";
import {
 CRF_TEMPLATES,getCrfTemplate,missingCrfFields,safeCrfFormValues,
 validateCrfScoring,CRF_SENSITIVE_FORM_CODES
} from "../src/lib/crf-templates";

describe("Revised ACReSAL CRF Manual template companion",()=>{
 it("covers every mandatory form and all T12 and T15 subforms",()=>{
  expect(CRF_TEMPLATES).toHaveLength(26);
  for(let number=1;number<=19;number++){
   const code="T"+number;
   expect(CRF_TEMPLATES.some(t=>t.code===code||t.code.startsWith(code)&&[12,15].includes(number))).toBe(true);
  }
  for(const code of ["T12A","T12B","T12C","T12D","T15A","T15B","T15C","T15D","T15E"])
   expect(getCrfTemplate(code)?.fields.length).toBeGreaterThan(0);
  expect(CRF_SENSITIVE_FORM_CODES.has("T15C")).toBe(true);
  expect(getCrfTemplate("T17")?.manualPage).toBe(98);
 });
 it("prevents new fields, raw identity-field keys, markup and oversized untrusted values",()=>{
  const t=getCrfTemplate("T1")!;
  expect(()=>safeCrfFormValues(t,{nin:"00000000"})).toThrow(/not permitted/);
  expect(()=>safeCrfFormValues(t,{gibberish:"x"})).toThrow(/not permitted/);
  expect(()=>safeCrfFormValues(t,{savings_months:"<iframe/>"})).toThrow(/Upload/);
  expect(()=>safeCrfFormValues(t,{savings_months:"X".repeat(2801)})).toThrow(/under 2800/);
  expect(safeCrfFormValues(t,{savings_months:" 3 "})).toEqual({savings_months:"3"});
  expect(missingCrfFields(t,{savings_months:"3"}).length).toBeGreaterThan(5);
 });
 it("enforces T6 score caps, minimum 60 and absolute-rejection cases",()=>{
  const t=getCrfTemplate("T6")!;
  const passing={
    qualification:"15",technical:"12",cost:"12",market:"8",repayment:"15",
    gender:"8",safeguards:"5",climate:"5",decision:"Approve with conditions",
    appraiser:"CRF appraisal team",spmu_decision_ref:"SPMU-REF"
  };
  expect(()=>validateCrfScoring(t,passing)).not.toThrow();
  expect(()=>validateCrfScoring(t,{...passing,repayment:"21"})).toThrow(/between 0 and 20/);
  expect(()=>validateCrfScoring(t,{...passing,qualification:"0"})).toThrow(/requires rejection/);
  expect(()=>validateCrfScoring(t,{...passing,qualification:"0",decision:"Reject"})).not.toThrow();
  expect(()=>validateCrfScoring(t,{...passing,qualification:"5",technical:"0",cost:"0",
   market:"0",repayment:"5",gender:"0",safeguards:"0",climate:"0"})).toThrow(/below 60/);
 });
});
