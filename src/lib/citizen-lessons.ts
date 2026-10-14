/**
 * Curated plain-language citizen education. Sources are public primary institutions.
 * No personal data, inferred local-language translations or automated government claims.
 * Local adaptation and official approval are required before distributing as extension instruction.
 */
export type CitizenLesson={
  id:string;category:"Climate"|"Land"|"Water"|"Community"|"Maps";
  title:string;level:string;minutes:number;summary:string;
  why:string;actions:string[];remember:string;
  question:string;choices:[string,string,string];correct:number;
  source:{name:string;url:string};
};

export const citizenLessons:CitizenLesson[]=[
  {
    id:"acresal",category:"Community",title:"What ACReSAL does",level:"Start here",minutes:3,
    summary:"ACReSAL means Agro-Climatic Resilience in Semi-Arid Landscapes. It supports healthier land, better water management and stronger communities in northern Nigeria.",
    why:"Restoring land and keeping shared projects working takes both trained institutions and local participation.",
    actions:["Ask your community focal person which intervention serves your area and who maintains it.",
      "Take part in community meetings, training and agreed maintenance visits.",
      "Report a blocked drainage, damaged borehole or failing restoration site through CARE-Map."],
    remember:"A project is not finished simply because construction is finished. Care and follow-up matter.",
    question:"Who should help keep a completed community project working?",
    choices:["Only the construction contractor","The community together with responsible project teams","Nobody after handover"],
    correct:1,source:{name:"ACReSAL Nigeria – Project overview",url:"https://acresal.gov.ng/"}
  },
  {
    id:"climate",category:"Climate",title:"Climate change and our daily lives",level:"Everyday basics",minutes:4,
    summary:"Climate means usual weather patterns over many years. Climate change can alter rainfall, heat and the risks faced by farms, water supplies and communities.",
    why:"Changing rainfall and temperature can affect crop growth, soil moisture, floods and water availability. One unusual rainy day alone does not prove climate change.",
    actions:["Pay attention to official seasonal forecasts and warnings.",
      "Discuss local rainy-season changes with extension officers before changing farm practices.",
      "Protect trees, soil cover and water points that help communities cope with weather extremes."],
    remember:"Weather describes today. Climate describes patterns over many years.",
    question:"Which statement is correct?",
    choices:["One hot afternoon proves climate change","Climate is the long-term pattern; weather changes day to day","Rainfall never varies"],
    correct:1,source:{name:"World Bank – ACReSAL climate resilience",url:"https://www.worldbank.org/en/news/press-release/2021/12/15/new-project-to-build-a-climate-resilient-landscape-in-nigeria"}
  },
  {
    id:"erosion",category:"Land",title:"Stop soil being washed away",level:"On the farm",minutes:4,
    summary:"Erosion happens when flowing water or wind carries away soil. Exposed and compacted soil is especially vulnerable.",
    why:"Soil loss can lower farm productivity, damage roads and fill drains or streams with sediment.",
    actions:["Keep suitable crop residues, mulch or cover plants on exposed soil where locally appropriate.",
      "Avoid dumping waste into drains; report growing gullies early.",
      "Ask extension officers before digging channels or changing drainage routes, especially near homes."],
    remember:"Healthy ground cover slows runoff and helps water soak into soil.",
    question:"What is a useful way to protect exposed soil?",
    choices:["Remove all ground cover","Maintain suitable mulch or cover plants","Direct runoff at the nearest house"],
    correct:1,source:{name:"FAO – Soil organic cover",url:"https://www.fao.org/conservation-agriculture/in-practice/soil-organic-cover/en/"}
  },
  {
    id:"water",category:"Water",title:"Protect our water and drainage",level:"Community practice",minutes:4,
    summary:"Clean drainage routes, cared-for boreholes and safe water practices support healthier communities.",
    why:"Blocked or damaged water infrastructure can reduce access, increase flooding risk and make maintenance more costly.",
    actions:["Keep refuse and loose soil out of drains and waterways.",
      "Report leaks, broken borehole components and exposed electrical equipment; do not attempt unsafe repairs.",
      "Agree on routine community inspection and a named person to report defects."],
    remember:"Report faults early; do not enter floodwater or attempt dangerous repairs.",
    question:"What should you do when a borehole pump is damaged?",
    choices:["Force it to run","Report it to the responsible team","Ignore it until it fails completely"],
    correct:1,source:{name:"ACReSAL – Water resources management",url:"https://acresal.gov.ng/"}
  },
  {
    id:"trees",category:"Land",title:"Care for restored trees and vegetation",level:"Community practice",minutes:4,
    summary:"New trees and restored vegetation need the right species, site care and follow-up after planting.",
    why:"Vegetation can protect soil and support healthier landscapes. Simply counting seedlings planted does not prove restoration success.",
    actions:["Follow locally approved species and planting guidance from forestry/extension staff.",
      "Protect agreed planting areas from uncontrolled cutting, fire and grazing where applicable.",
      "Record surviving plants and report pests, drought stress or damage during follow-up visits."],
    remember:"Tree survival and healthy vegetation matter more than planting-day numbers.",
    question:"What is a better sign of tree-planting success?",
    choices:["Number of photos taken on planting day","Healthy surviving vegetation after follow-up","Number of empty planting bags"],
    correct:1,source:{name:"ACReSAL – Landscape restoration",url:"https://acresal.gov.ng/"}
  },
  {
    id:"farming",category:"Land",title:"Farm in ways that protect soil",level:"On the farm",minutes:4,
    summary:"Climate-resilient farming includes protecting soil cover, avoiding unnecessary disturbance and choosing crop combinations suited to local conditions.",
    why:"Keeping organic cover and diversified crops can support moisture retention and soil health.",
    actions:["Discuss locally suitable crop rotation or mixed cropping with an extension officer.",
      "Keep safe, suitable crop residues as soil cover rather than burning them where this is practical.",
      "Match soil and water conservation measures to the actual field slope and soil type."],
    remember:"There is no single farming practice that fits every field. Local advice matters.",
    question:"Which approach best supports soil conservation?",
    choices:["Protect soil cover and choose suitable crop diversity","Burn every residue and expose the soil","Ignore field slope and runoff"],
    correct:0,source:{name:"FAO – Conservation agriculture",url:"https://www.fao.org/conservation-agriculture/en/"}
  },
  {
    id:"ndvi",category:"Maps",title:"Understand the green and orange vegetation map",level:"Map reading",minutes:3,
    summary:"CARE-Map compares satellite observations from two periods and estimates the area with vegetation using NDVI, an index based on reflected light.",
    why:"A greener result can reflect seasonal rainfall, farming cycles or land recovery. One NDVI comparison alone does not prove that a particular ACReSAL project caused the change.",
    actions:["On the public map, choose Vegetation change and tap Find published vegetation change.",
      "Read the baseline and comparison dates and the amount of estimated change in hectares.",
      "Treat the colored outline as the whole analysis area, not a picture of exactly which trees grew or disappeared."],
    remember:"Green means estimated vegetation gain; orange means estimated loss. Compare similar seasons and verify on the ground.",
    question:"What does a green NDVI analysis polygon prove?",
    choices:["All trees inside it were newly planted","The AOI has an estimated vegetation-area increase for the selected dates","ACReSAL alone caused the change"],
    correct:1,source:{name:"ACReSAL – Environmental information and landscape management",url:"https://acresal.gov.ng/"}
  }
];
export const citizenCategories=["All topics","Climate","Land","Water","Community","Maps"] as const;
