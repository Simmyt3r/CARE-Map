export const DEFAULT_LOCALE="en";

export const targetLanguages=[
  {code:"en",name:"English",nativeName:"English"},
  {code:"tiv",name:"Tiv",nativeName:"Tiv"},
  {code:"idu",name:"Idoma",nativeName:"Idoma"},
  {code:"ige",name:"Igede",nativeName:"Igede"}
] as const;

export type LocaleCode=(typeof targetLanguages)[number]["code"];

export const englishCatalog={
  "nav.publicMap":"Public Map",
  "nav.reportIssue":"Report Issue",
  "nav.register":"Register",
  "nav.privacy":"Privacy",
  "nav.staffLogin":"Staff Login",
  "nav.language":"Language",

  "home.badge":"Benue ACReSAL GIS",
  "home.title":"See interventions. Report problems. Act earlier.",
  "home.intro":"CARE-Map tracks boreholes, project assets, forests, afforestation sites and rivers across Benue State using field coordinates and GIS analysis.",
  "home.reportButton":"Report a problem",
  "home.staffButton":"Staff workspace",
  "home.howTitle":"How it works",
  "home.captureTitle":"1. Capture",
  "home.captureBody":"Staff record GPS coordinates and intervention details.",
  "home.mapTitle":"2. Map",
  "home.mapBody":"PostGIS stores the geography and the public map loads only the visible area.",
  "home.respondTitle":"3. Respond",
  "home.respondBody":"Community reports and risk scores help staff prioritize action.",
  "home.liveMapTitle":"Live intervention map",
  "home.liveMapBody":"Zoom or move the map to query the visible area.",

  "map.layer":"Layer",
  "map.allInterventions":"All interventions",
  "map.boreholes":"Boreholes",
  "map.assets":"Assets",
  "map.forests":"Forests",
  "map.rivers":"Rivers",
  "map.vegetationChange":"Vegetation change",
  "map.lga":"LGA",
  "map.allLgas":"All LGAs",
  "map.status":"Status",
  "map.anyStatus":"Any status",
  "map.functional":"Functional",
  "map.needsMaintenance":"Needs maintenance",
  "map.nonFunctional":"Non-functional",
  "map.legend":"Legend",
  "map.low":"Low",
  "map.medium":"Medium",
  "map.high":"High",
  "map.critical":"Critical",
  "map.dataError":"Map data could not be loaded.",
  "map.aria":"CARE-Map interactive intervention map",

  "register.title":"Community account",
  "register.subtitle":"Registration is optional. It gives you an identity for submitted reports and future tracking features.",
  "register.fullName":"Full name",
  "register.email":"Email",
  "register.password":"Password",
  "register.privacyPrefix":"I have read the CARE-Map privacy notice and understand how my account data and reports are processed.",
  "register.submit":"Create community account",
  "register.creating":"Creating…",
  "register.failed":"Registration failed.",

  "report.title":"Community report",
  "report.subtitle":"You can report without creating an account. Coordinates can be captured from your phone or entered manually.",
  "report.contextTitle":"Reporting against a mapped CARE-Map resource",
  "report.reference":"reference",
  "report.offlineWaiting":"report(s) waiting for internet. Keep this browser data until they are submitted.",
  "report.type":"Report type",
  "report.problem":"Problem / fault",
  "report.stream":"Unknown small river / stream",
  "report.nameOptional":"Your name (optional)",
  "report.contactOptional":"Contact (optional)",
  "report.contactPlaceholder":"Phone or email",
  "report.optionalConsent":"I consent to CARE-Map storing the optional name/contact details I provided so staff can follow up on this report. I can later withdraw this consent or request erasure.",
  "report.description":"Description",
  "report.descriptionPlaceholder":"Describe what you observed, nearby landmarks, severity, or local name.",
  "report.latitude":"Latitude",
  "report.longitude":"Longitude",
  "report.gpsAccuracy":"GPS accuracy",
  "report.manualUnknown":"Manual / unknown",
  "report.privacyAck":"I have read the CARE-Map privacy notice and understand that the report description and location will be processed for project monitoring and response.",
  "report.useGps":"Use my current GPS",
  "report.submit":"Submit report",
  "report.submitting":"Submitting…",
  "report.gpsUnavailable":"Location capture is not available on this device.",
  "report.gpsReading":"Reading high-accuracy GPS…",
  "report.gpsFailed":"Could not read your location. Enter the coordinates manually.",
  "report.gpsCapturedPrefix":"GPS captured. Reported accuracy:",
  "report.reconnectSubmittedSuffix":"queued report(s) submitted after connection returned.",
  "report.privacyRequired":"Read and acknowledge the privacy notice before submitting.",
  "report.contactConsentRequired":"Consent is required if you choose to provide your name or contact details.",
  "report.offlineSaved":"No reliable connection. This report is saved on this device and will retry automatically when internet returns.",
  "report.submitFailed":"Report could not be submitted.",
  "report.submitted":"Report submitted successfully. Reference:",

  "common.loading":"Loading…",
  "common.privacyNotice":"Privacy notice",
  "common.englishFallback":"English fallback",
  "privacy.englishOnly":"The legal privacy notice remains in English until a separately reviewed legal translation is approved."
} as const;

export type TranslationKey=keyof typeof englishCatalog;
export type TranslationMap=Partial<Record<TranslationKey,string>>;

export const requiredTranslationKeys=Object.keys(englishCatalog) as TranslationKey[];

export function normalizeLocale(value:unknown):LocaleCode{
  const code=String(value||"").trim().toLowerCase();
  return targetLanguages.some(x=>x.code===code)?code as LocaleCode:DEFAULT_LOCALE;
}

export function validateTranslationMap(value:unknown){
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const translations:Record<string,string>={};
  const unknown:string[]=[];
  for(const[key,raw]of Object.entries(source)){
    if(!Object.prototype.hasOwnProperty.call(englishCatalog,key)){unknown.push(key);continue;}
    const text=String(raw??"").trim();
    if(text)translations[key]=text.slice(0,2000);
  }
  const missing=requiredTranslationKeys.filter(key=>!translations[key]);
  const translated=requiredTranslationKeys.length-missing.length;
  const coverage=requiredTranslationKeys.length?Math.round((translated/requiredTranslationKeys.length)*10000)/100:100;
  return{translations,unknown,missing,translated,required:requiredTranslationKeys.length,coverage};
}

export function mergeCatalog(map:Record<string,string>|null|undefined){
  return{...englishCatalog,...(map||{})} as Record<TranslationKey,string>;
}
