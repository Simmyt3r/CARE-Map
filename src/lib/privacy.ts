export const PRIVACY_NOTICE_VERSION="2026-10-07";

export const dataSubjectRequestTypes=[
  "access","rectification","erasure","restriction","objection","portability","withdraw_consent","complaint"
] as const;
export type DataSubjectRequestType=(typeof dataSubjectRequestTypes)[number];

export const dataSubjectRequestStatuses=[
  "submitted","identity_verification_required","in_review","completed","rejected"
] as const;
export type DataSubjectRequestStatus=(typeof dataSubjectRequestStatuses)[number];

export function isDataSubjectRequestType(value:unknown):value is DataSubjectRequestType{
  return dataSubjectRequestTypes.includes(String(value||"").trim().toLowerCase() as DataSubjectRequestType);
}

export function isDataSubjectRequestStatus(value:unknown):value is DataSubjectRequestStatus{
  return dataSubjectRequestStatuses.includes(String(value||"").trim().toLowerCase() as DataSubjectRequestStatus);
}

export function dataSubjectRequestLabel(value:DataSubjectRequestType){
  return value.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
}

export function privacyReference(){
  const date=new Date().toISOString().slice(0,10).replaceAll("-","");
  const random=crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
  return "PRV-"+date+"-"+random;
}

export function breachHoursRemaining(detectedAt:string|Date,now=new Date()){
  const detected=new Date(detectedAt);
  if(Number.isNaN(detected.getTime()))return null;
  return Math.max(0,72-((now.getTime()-detected.getTime())/3_600_000));
}
