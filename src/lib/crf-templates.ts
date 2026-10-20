/**
 * Index for the mandatory forms in the revised ACReSAL CRF Manual, Part Four,
 * pages 61–103. This is a data-entry COMPANION, not a modified legal form.
 * Original printed/PDF content, signatures and bank instructions remain in
 * the signed, SPMU-controlled source document.
 */
export type CrfFormScope="registry"|"finance"|"field"|"report";
export type CrfFormField={key:string;label:string;section?:string;required?:boolean;kind?:"text"|"date"|"number"|"textarea"};
export type CrfTemplate={code:string;title:string;manualPage:number;scope:CrfFormScope;fields:CrfFormField[];note?:string};
const f=(key:string,label:string,section?:string,required=false,kind:CrfFormField["kind"]="text"):CrfFormField=>({key,label,section,required,kind});
const d=(code:string,title:string,manualPage:number,scope:CrfFormScope,fields:CrfFormField[],note?:string):CrfTemplate=>({code,title,manualPage,scope,fields,note});
export const CRF_TEMPLATES:CrfTemplate[]=[
 d("T1","CIG Loan Application Form",62,"registry",[
  f("cig_registration","Registration number and date","A. The group",true),
  f("community_ward","Community / ward / LGA / state","A. The group",true),
  f("micro_watershed","Micro-watershed","A. The group"),
  f("date_formed","Date group formed","A. The group",false,"date"),
  f("members_female","Female members (of exactly 15)","A. The group",true,"number"),
  f("members_male","Male members (of exactly 15)","A. The group",true,"number"),
  f("chair_reference","Chairperson reference (no private phone)","A. The group",true),
  f("secretary_reference","Secretary reference","A. The group"),
  f("treasurer_reference","Treasurer reference","A. The group"),
  f("group_account_evidence","Group bank and account verification evidence reference","A. The group",true),
  f("savings_months","Months of consistent savings","B. Qualification",true,"number"),
  f("total_group_savings","Total savings (₦)","B. Qualification",true,"number"),
  f("internal_loans","Internal loans made and repaid","B. Qualification"),
  f("meetings_last_three_months","Meetings in last 3 months","B. Qualification"),
  f("qualification_date","Certificate of qualification date","B. Qualification",false,"date"),
  f("existing_crf_arrangement","Existing CRF balance and arrangement reference","B. Qualification"),
  f("existing_payment_compliance","Arrangement instalments paid on time for 3 months","B. Qualification"),
  f("approved_enterprise","Enterprise on approved menu","C. Loan requested",true),
  f("scale","Production scale","C. Loan requested"),
  f("plan_cost","Total plan cost (₦)","C. Loan requested",true,"number"),
  f("group_contribution","Group contribution (₦)","C. Loan requested"),
  f("loan_requested","Loan requested (₦)","C. Loan requested",true,"number"),
  f("tenor","Tenor (3, 6 or 12 months)","C. Loan requested",true),
  f("gross_revenue","Expected gross revenue (₦)","C. Loan requested"),
  f("net_surplus","Expected net surplus (₦)","C. Loan requested"),
  f("instalment_dates","Proposed instalments and dates","C. Loan requested",false,"textarea"),
  f("attachment_checklist","T2/T3-5, qualification, minutes, registration, statement, 15-member list, T6, E&S screening, land consent if applicable","D. Attachments",true,"textarea"),
  f("member_declarations","All 15 member signatures/thumbprints retained in signed original","Declaration",true),
  f("cba_completeness","CBA signed completeness certificate evidence","Declaration",true),
  f("crfmc_received_on","Date received by CRFMC","Declaration",false,"date")
 ],"Never enter NINs, member phone numbers, account numbers or signature images in CARE-Map metadata. Preserve them only in the controlled original."),
 d("T2","Business Plan Format",65,"registry",[
  f("business","The business: what, where and why","1. The business",true,"textarea"),
  f("market","The market, price and price source","2. The market",true,"textarea"),
  f("operations","Calendar from production to sale","3. Operations",true,"textarea"),
  f("costing_ref","Completed T3, T4 or T5 cost sheet reference","4. Costs",true),
  f("revenue_margin","Quantity, price, gross margin and surplus","5. Revenue and margin",true,"textarea"),
  f("loan_schedule","Loan size, tenor and instalments based on cashflow","6. Loan and repayment",true,"textarea"),
  f("allocation","Allocation among all 15 members","7. Allocation",true,"textarea"),
  f("risks","Three main risks and mitigations","8. Risks",true,"textarea"),
  f("inclusion","Women's participation and proceeds protection","9. Inclusion",true,"textarea"),
  f("safeguards","E&S screening and mitigation measures","10. Safeguards",true,"textarea")
 ],"Original business plan is limited to four pages."),
 d("T3","Hectare Budget — Crop Production",66,"registry",[
  f("crop_season","Crop and season","Cost per hectare",true),
  f("local_price_source","SPMU-validated local unit price reference","Cost per hectare",true),
  f("inputs_budget","Seed, inputs, land preparation, labour, water, transport and other production inputs (₦)","A. Cost of production",true,"textarea"),
  f("total_production_cost","Total cost per hectare (₦)","A. Cost of production",true,"number"),
  f("yield_price","Yield, market price and source","B. Revenue and margin",true),
  f("gross_margin","Revenue and margin (₦)","B. Revenue and margin",true),
  f("loan_sizing","Group contribution, loan sizing and working capital","C. Loan sizing",true),
  f("repayment_check","Cash-flow repayment test","D. Repayment check",true)
 ],"No worked-example prices may be reused as local validated prices."),
 d("T4","Project Model — Crop Processing",69,"registry",[
  f("equipment","Equipment, quantity and validated unit rates","A. One-off investment",true,"textarea"),
  f("investment_subtotal","One-off capital total (₦)","A. One-off investment",true,"number"),
  f("working_capital","Raw produce, power, packaging, labour, maintenance and transport","B. Working capital",true,"textarea"),
  f("monthly_margin","Throughput, revenue, recurring costs and margin","C. Monthly margin",true,"textarea"),
  f("feasibility_tests","Document the four feasibility checks","D. Feasibility",true,"textarea")
 ]),
 d("T5","Project Model — Produce Marketing",71,"registry",[
  f("purchase_storage_cost","Procurement, handling, storage, treatment and total outlay","A. The cycle",true,"textarea"),
  f("sale_margin","Quantity, storage loss, sale price, gross margin and rate","B. Sale and margin",true,"textarea"),
  f("floor_price","Agreed floor price trigger","C. Price risk",true),
  f("storage_losses","Moisture, treatment, inspections and measured losses","C. Storage risk",true),
  f("stock_controls","Two-key custody and stock count evidence","C. Diversion control",true),
  f("sale_to_due_buffer","Sale planned at least 21 days before instalment","C. Late-sale control",true)
 ]),
 d("T6","Appraisal and Scoring Sheet",72,"registry",[
  ...[["qualification","Group qualification /20"],["technical","Technical soundness /15"],["cost","Cost realism /15"],
     ["market","Market and price basis /10"],["repayment","Repayment capacity /20"],["gender","Gender inclusion /10"],
     ["safeguards","E&S compliance /5"],["climate","Climate-smart content /5"]]
     .map(([key,label])=>f(key,label,"Scoring (100 marks)",true,"number")),
  f("decision","Recorded decision and conditions","Decision",true,"textarea"),
  f("appraiser","Appraisal leader and designation","Sign-off references",true),
  f("spmu_decision_ref","SPMU decision record reference","Sign-off references",true)
 ],"Below 60: defer/reject. Zero in qualification or repayment capacity: reject regardless of total."),
 d("T7","Letter of Loan Offer",73,"finance",[
  f("offer_ref","CRF offer reference","Letter details",true),
  f("offer_date","Date issued","Letter details",true,"date"),
  f("approval_memo","SPMU loan approval reference and date","Offer terms",true),
  f("enterprise","Approved enterprise and purpose","Offer terms",true),
  f("principal","Principal (₦)","Offer terms",true,"number"),
  f("charge_tenor","Flat service charge and tenor","Offer terms",true),
  f("total_repayable","Total repayable (₦)","Offer terms",true,"number"),
  f("instalments","Instalment dates, amounts and Account 2 reference","Offer terms",true,"textarea"),
  f("conditions","Executed T8, T9, T10, bank proof, oral explanation, Loan App, endorsed T15C","Conditions precedent",true,"textarea"),
  f("acceptance_date","Date accepted (within 21 days)","Acceptance",false,"date")
 ]),
 d("T8","CRF Loan Agreement (CRFMC–CIG)",75,"finance",[
  f("agreement_date","Date and parties","1. The loan",true),
  f("loan_terms","Principal, tenor, purpose, charge and repayment dates","1. The loan",true,"textarea"),
  f("borrower_obligations","Borrower's obligations and permitted expenditure","2. Borrower obligations",true,"textarea"),
  f("crfmc_obligations","CRFMC obligations","3. CRFMC obligations",true,"textarea"),
  f("joint_liability","Joint and several liability accepted by 15 members","4. Joint liability",true),
  f("events_default","Events of default included","5. Default",true),
  f("deferment_terms","Deferment / rescheduling provisions","6. Rescheduling",true),
  f("discharge_terms","Discharge provisions","7. Discharge",true),
  f("signatory_evidence","All 15 CIG and 4 CRFMC signatures, witnesses, dates","8. General",true)
 ]),
 d("T9","Joint Liability and Guarantee Undertaking",78,"finance",[
  f("loan_ref","CIG and loan reference","Borrower and obligation",true),
  f("joint_guarantee","Joint and several undertaking","Guarantee",true),
  f("signatures","Fifteen signatures/thumbprints evidenced in signed original","Execution",true)
 ]),
 d("T10","Repayment Schedule",79,"finance",[
  f("loan_ref","Group and loan reference","Loan particulars",true),
  f("disbursement_date","Disbursement date","Loan particulars",true,"date"),
  f("rows","Instalment, due date, principal, service charge, total due, cumulative balance, date paid, receipt reference","Schedule",true,"textarea"),
  f("signed_borrower","Signed for borrower and date","Certification",true),
  f("signed_crfmc","Signed for CRFMC and date","Certification",true)
 ]),
 d("T11","Disbursement Voucher and Acknowledgement",80,"finance",[
  f("loan","Community, CIG, loan reference","Voucher",true),
  f("amount","Amount in figures and words (₦)","Voucher",true),
  f("tranche","Tranche 1/2 and total tranches","Voucher",true),
  f("account1_ref","CRFMC Account 1 evidence reference","Voucher",true),
  f("cig_account_ref","CIG verified account reference","Voucher",true),
  f("transfer","Bank transfer ref and date","Voucher",true),
  f("t15c","T15C endorsed payment instruction number","Voucher",true),
  f("purpose","Purpose per approved business plan","Voucher",true),
  f("ledger_ref","T12A ledger entry and CRF Loan App entry time","Voucher",true),
  f("signatures","CRFMC Chair/Treasurer, CIG Chair acknowledgement, CBA verification within 7 days","Authorizations",true)
 ]),
 d("T12A","CRF Disbursement Ledger",81,"finance",[
  f("ledger_rows","Date, source/destination, reference, SPMU receipts, CIG disbursements, CIG name, Account 1 balance, posted by","Ledger rows",true,"textarea")]),
 d("T12B","CRF Repayment Ledger",81,"finance",[
  f("ledger_rows","Date, CIG and loan reference, receipt, principal, service charge, default fee, total, balance outstanding","Ledger rows",true,"textarea")]),
 d("T12C","CIG Loan Register",81,"finance",[
  f("ledger_rows","Date, description, amount received, amount repaid, balance, receipt, recorded by","CIG entries",true,"textarea")]),
 d("T12D","CRF Disbursement Register",81,"finance",[
  f("register_rows","CIG, approved amount, 70%/30% tranches, dates, T15C, total disbursed, unmet conditions, status","Disbursement register",true,"textarea")]),
 d("T13","Arrears and Demand Notice",83,"finance",[
  f("stage","Day 1, 15, 30 or 60 stage","Notice",true),
  f("issued_on","Issue date","Notice",true,"date"),
  f("missed_due","Missed instalments and due dates","Notice",true),
  f("arrears","Amount in arrears (₦)","Notice",true,"number"),
  f("default_fee","Applicable default fee (₦)","Notice",true,"number"),
  f("total_due","Total now due (₦)","Notice",true,"number"),
  f("reason","Group explanation and genuine difficulty assessment","Recovery response",true,"textarea"),
  f("agreed_action","Agreed action and deadline","Recovery response",true,"textarea"),
  f("signed_notice","CRFMC signatory and recipient evidence","Acknowledgement",true)
 ]),
 d("T14","Monthly Community CRF Return",84,"report",[
  f("period","Reporting month (YYYY-MM)","Header",true),
  f("account1_funds_month","Funds received from SPMU into Account 1: this month / cumulative (₦)","This month / cumulative"),
  f("cigs_financed","CIGs financed: this month / cumulative","This month / cumulative"),
  f("disbursed","Disbursed to CIGs: this month / cumulative (₦)","This month / cumulative",true),
  f("women_groups","Women-led/owned CIGs financed: this month / cumulative","This month / cumulative"),
  f("women_disbursed","Disbursed to women-led CIGs: this month / cumulative (₦)","This month / cumulative"),
  f("due","Repayment due: this month / cumulative (₦)","This month / cumulative",true),
  f("recovered","Recovered into Account 2: this month / cumulative (₦)","This month / cumulative",true),
  f("recovery_rate","Recovery rate: this month / cumulative (%)","This month / cumulative",true),
  f("groups_arrears","Number of groups in arrears: this month / cumulative","This month / cumulative"),
  f("arrears60","Amount over 60 days in arrears (₦)","This month / cumulative"),
  f("account1_balance","Account 1 balance (₦)","Bank reconciliations",true),
  f("account2_balance","Account 2 balance (₦)","Bank reconciliations",true),
  f("grievances","Grievances received / resolved","GRM"),
  f("issues","Main issues this month","Narrative",false,"textarea"),
  f("support","Support requested from SPMU","Narrative",false,"textarea"),
  f("signed_return","CRFMC Chairperson and CBA verification + dates","Certification",true)
 ],"Submit to LGPMC/SPMU by the 7th. A digital note does not replace signed community return or bank reconciliation."),
 d("T15A","Mandate and Fiduciary Control Instruction",87,"finance",[
  f("community","CRFMC community and two account reference IDs","Mandate",true),
  f("bank_ack","Bank acknowledgement and effective date","Mandate",true),
  f("monitoring_rights","SPMU/FPMU monitoring consent verified","Controls",true),
  f("prior_endorsement","Prior endorsement on every debit verified","Controls",true),
  f("suspension","SPC right to instruct bank debit suspension verified","Controls",true),
  f("four_signatories","Four CRFMC signatories with at least one woman evidenced","Execution",true),
  f("spmu_confirmation","SPMU confirmation and lodgement reference","Execution",true)
 ]),
 d("T15B","Schedule of Authorised SPMU Endorsing Officers",90,"finance",[
  f("schedule_ref","Schedule reference and effective date","Authority",true),
  f("officers","Named approved SPMU endorsing officers; specimen signatures retained in original","Authority",true,"textarea"),
  f("spc_signed","State Project Coordinator signature evidence","Execution",true),
  f("bank_ack","Bank lodgement and acknowledgement reference","Execution",true)
 ]),
 d("T15C","Payment Instruction (Debit Mandate)",91,"finance",[
  f("instruction_ref","Numbered payment instruction and date","Mandate",true),
  f("source_account","Account 1 or Account 2 mandate reference","Mandate",true),
  f("payee_schedule","Complete verified payee schedule (secured original)","Payees",true),
  f("amount","Total amount (₦)","Payees",true,"number"),
  f("crfmc_signatories","Two authorized signatories, chairperson or treasurer required","Execution",true),
  f("spmu_endorsement","Authorized SPMU prior endorsement reference","Execution",true),
  f("bank_execution","Bank execution confirmation reference","Execution")
 ],"Recording this form in CARE-Map does not authorize a transfer or satisfy bank-side controls."),
 d("T15D","Notice of Variation or Revocation",93,"finance",[
  f("variation_ref","Notice reference and date","Variation",true),
  f("change","Details of change or revocation","Variation",true,"textarea"),
  f("all_crfmc_signatures","All CRFMC signatories' signatures evidenced","Execution",true),
  f("spc_countersign","SPC counter-signature evidenced","Execution",true),
  f("bank_ack","Bank acknowledgment","Execution",true)
 ]),
 d("T15E","Adoption and Lodgement Record",95,"finance",[
  f("community","Community and CRFMC","Register",true),
  f("account_refs","Two account identifiers held in bank-controlled evidence","Register",true),
  f("t15a_ref","T15A bank acknowledgement reference","Register",true),
  f("t15b_ref","T15B authorized officer schedule reference","Register",true),
  f("lodgement_date","Date lodged and acknowledged","Register",true,"date")
 ]),
 d("T16","Corrective Action Log",96,"field",[
  f("period","State and reporting period","Log header",true),
  f("issue_source","Issue/date/source and affected community/CIG","Finding",true,"textarea"),
  f("responsible_party","Responsible party (not the approver)","Action",true),
  f("agreed_action","Agreed action and approving authority","Action",true,"textarea"),
  f("deadline","Deadline","Action",true,"date"),
  f("status","Open, in progress, overdue or closed","Closure",true),
  f("completion_evidence","Evidence/date of completion if closed","Closure"),
  f("spc_certification","State Project Coordinator certification reference","Certification")
 ]),
 d("T17","CIG Asset Register",98,"field",[
  f("designated_officer","Designated member responsible for register","Header",true),
  f("assets","Purchase date, description, serial, receipt, cost, location, custodian, condition and disposal approval","Asset rows",true,"textarea"),
  f("monthly_cba_signoff","Monthly CBA inspections and signatures","Verification",true),
  f("auditor_verification","SPMU internal audit sighting and discrepancy follow-up","Verification")
 ],"Missing or mismatched assets must be escalated on the day found and logged in T16."),
 d("T18","CRF Market Linkage Agreement",99,"finance",[
  f("cig_offtaker","CIG registration, off-taker CAC reference and T19 register entry","A. Parties",true),
  f("commodity_grade","Commodity, grade, quantity and delivery unit","B. Sale",true),
  f("quality_delivery","Quality standard, test, delivery place/date, transport","B. Sale",true,"textarea"),
  f("price_basis","Market evidence, price reference and floor","B. Sale",true),
  f("terms","Payment timing (no more than 7 days after delivery)","C. Payment",true),
  f("account2_remittance","Optional consent and Account 2 repayment-remittance mandate","C. Payment"),
  f("signatures","CIG and off-taker signatures; CRFMC where involved; SPMU witness","Execution",true)
 ]),
 d("T19","State Off-taker Register",102,"report",[
  f("officer_period","Responsible officer, date compiled and reviewed","State header",true),
  f("buyers","Off-taker CAC reference, produce, volume, quality, price basis, payment terms, collection point, review date","Register",true,"textarea"),
  f("payment_checks","Registration and references from at least two producers","Due diligence",true),
  f("removed_buyers","Removed buyers with reasons, date and approving authority","Removals")
 ],"Benue is not among the initially identified three states for the formal market-linkage pilot; use only when authorized.")
];
export const CRF_TEMPLATE_CODES=CRF_TEMPLATES.map(t=>t.code);
export function getCrfTemplate(code:string){return CRF_TEMPLATES.find(t=>t.code===code);}
export const CRF_SENSITIVE_FORM_CODES=new Set(CRF_TEMPLATES.filter(t=>t.scope==="finance").map(t=>t.code));
export function safeCrfFormValues(template:CrfTemplate,values:unknown){
 if(!values||typeof values!=="object"||Array.isArray(values))throw Error("Structured form metadata is required.");
 const input=values as Record<string,unknown>;
 const fields=new Map(template.fields.map(f=>[f.key,f]));
 const forbidden=/(^|_)(nin|bvn|phone|telephone|email|account_number|signature_image|passport|identity_document)($|_)/i;
 const output:Record<string,string>={};
 for(const [key,val] of Object.entries(input)){
  if(!fields.has(key)||forbidden.test(key))throw Error("Field not permitted in this template's metadata: "+key);
  if(typeof val!=="string"||val.length>2800)throw Error("Template values must be text under 2800 characters.");
  // Reject obvious HTML tags and embedded data URIs in freeform metadata.
  if(/<\/?[a-z][^>]*>|data:(?:image|application)\//i.test(val))throw Error("Upload documents only to approved controlled storage.");
  output[key]=val.trim();
 }
 return output;
}
export function missingCrfFields(template:CrfTemplate,values:Record<string,string>){
 return template.fields.filter(f=>f.required&&!values[f.key]?.trim()).map(f=>f.label);
}
export function validateCrfScoring(template:CrfTemplate,values:Record<string,string>){
 if(template.code!=="T6")return;
 const maxima:Record<string,number>={qualification:20,technical:15,cost:15,market:10,repayment:20,gender:10,safeguards:5,climate:5};
 const total=Object.entries(maxima).reduce((sum,[key,max])=>{
  const value=Number(values[key]);
  if(!Number.isInteger(value)||value<0||value>max)throw Error(key+" score must be between 0 and "+max);
  return sum+value;
 },0);
 const decision=values.decision?.toLowerCase()||"";
 if(total<60&&!/defer|reject/.test(decision))throw Error("A T6 score below 60 cannot be approved.");
 if((Number(values.qualification)===0||Number(values.repayment)===0)&&!/reject/.test(decision))
  throw Error("T6 qualification or repayment score of zero requires rejection.");
}
