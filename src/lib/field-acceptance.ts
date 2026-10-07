export type AcceptanceCheckStatus="not_run"|"pass"|"fail"|"blocked"|"not_applicable";
export type AcceptanceRunResult="pending"|"pass"|"fail"|"conditional";

export type AcceptanceCheckDefinition={
  key:string;
  category:"device"|"core"|"gis"|"offline"|"operations"|"advanced";
  label:string;
  instructions:string;
  required:boolean;
};

export const acceptanceChecks:AcceptanceCheckDefinition[]=[
  {
    key:"staff_login",category:"core",label:"Staff login and session",
    instructions:"Sign in on the target device, open the staff dashboard, refresh the page, and confirm the authenticated session remains valid.",
    required:true
  },
  {
    key:"public_map_mobile",category:"gis",label:"Public map on target device",
    instructions:"Open the public map, pan/zoom, change at least one filter, and open a mapped feature detail without layout or interaction failure.",
    required:true
  },
  {
    key:"device_gps_capture",category:"device",label:"High-accuracy GPS capture",
    instructions:"Use a CARE-Map GPS capture control outdoors. Confirm coordinates populate, accuracy is reported, and the position is reasonable against a known location.",
    required:true
  },
  {
    key:"staff_point_workflow",category:"gis",label:"Staff point intervention workflow",
    instructions:"Create or update a designated test borehole/asset using device GPS, then confirm the feature appears at the expected map location with its capture metadata.",
    required:true
  },
  {
    key:"public_report_online",category:"operations",label:"Online community report",
    instructions:"Submit a designated test report while online, record its reference, and confirm it appears in the staff report queue.",
    required:true
  },
  {
    key:"offline_shell",category:"offline",label:"Offline app shell",
    instructions:"Load CARE-Map once online, disconnect the device, then reopen a cached public shell page such as the report page and confirm the interface remains usable.",
    required:true
  },
  {
    key:"offline_report_queue",category:"offline",label:"Offline report queue",
    instructions:"While offline, submit a designated test report and confirm CARE-Map states that the report is saved on the device and waiting for internet.",
    required:true
  },
  {
    key:"reconnect_report_sync",category:"offline",label:"Reconnect and queued-report sync",
    instructions:"Restore connectivity after queuing the offline report. Confirm the queued count clears and the report appears in the staff report queue.",
    required:true
  },
  {
    key:"report_review_workflow",category:"operations",label:"Staff report review workflow",
    instructions:"Open the test report in staff operations, assign/review it, move it through an appropriate status transition, and confirm history is preserved.",
    required:true
  },
  {
    key:"responsive_mobile_ui",category:"device",label:"Mobile navigation and forms",
    instructions:"Check public and staff navigation, forms, tables and map controls on the target phone width. Confirm no essential control is trapped off-screen or uncloseable.",
    required:true
  },
  {
    key:"photo_upload",category:"advanced",label:"Field evidence photo upload",
    instructions:"Upload a JPEG/PNG/WebP evidence photo to a designated test report or resource and confirm it appears after refresh.",
    required:false
  },
  {
    key:"qr_resource_report",category:"advanced",label:"QR resource-to-report flow",
    instructions:"Scan or open a designated CARE-Map resource QR label and confirm the report form is linked to the correct mapped resource.",
    required:false
  },
  {
    key:"gis_export",category:"advanced",label:"GIS export opens downstream",
    instructions:"Export a small GeoJSON dataset and open it in QGIS or another GIS client. Confirm geometry and core attributes are usable.",
    required:false
  },
  {
    key:"map_print",category:"advanced",label:"Operational map print/PDF",
    instructions:"Create a Map Composer output and use browser Print / Save PDF. Confirm title, legend, map, scale and notes are legible.",
    required:false
  }
];

export function acceptanceFinalResult(checks:{status:AcceptanceCheckStatus;required:boolean}[]):AcceptanceRunResult{
  const required=checks.filter(x=>x.required);
  if(!required.length)return "conditional";
  if(required.some(x=>x.status==="not_run"))return "pending";
  if(required.some(x=>x.status==="fail"))return "fail";
  if(required.some(x=>x.status==="blocked"||x.status==="not_applicable"))return "conditional";
  return "pass";
}

export function canCompleteAcceptance(checks:{status:AcceptanceCheckStatus;required:boolean}[]){
  return checks.filter(x=>x.required).every(x=>x.status!=="not_run");
}

export function isAcceptanceCheckStatus(value:unknown):value is AcceptanceCheckStatus{
  return ["not_run","pass","fail","blocked","not_applicable"].includes(String(value||""));
}
