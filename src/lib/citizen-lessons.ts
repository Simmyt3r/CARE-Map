/**
 * CARE-Map citizen education curriculum. Plain-language, offline-renderable
 * lessons with named primary sources and illustrative (not surveyed) examples.
 * Content is educational; ACReSAL officers must approve local translations,
 * intervention-specific methods and official emergency guidance.
 */
export const citizenCategories=[
  "All topics","Getting started","Climate & weather","Land & soil",
  "Water & floods","Trees & farming","GIS & satellite","Community action"
] as const;
export type CitizenCategory=Exclude<(typeof citizenCategories)[number],"All topics">;
export type LessonGraphic="overview"|"climate"|"erosion"|"water"|"trees"|"farming"|"ndvi"|"flood"|"report"|"watershed"|"waste"|"warning";
export type CitizenLesson={
  id:string;category:CitizenCategory;title:string;level:string;minutes:number;
  summary:string;why:string;graphic:LessonGraphic;
  sections:{heading:string;body:string}[];
  example:{title:string;body:string};
  actions:string[];avoid:string;remember:string;
  terms:{term:string;definition:string}[];
  question:string;choices:[string,string,string];correct:number;
  source:{name:string;url:string};additionalSources?:{name:string;url:string}[];
};

export const citizenLessons:CitizenLesson[]=[
 {
  id:"acresal",category:"Getting started",graphic:"overview",
  title:"ACReSAL: why landscapes and communities matter",level:"Start here",minutes:7,
  summary:"Understand what ACReSAL seeks to address and why communities need to help care for environmental interventions after construction.",
  why:"Damaged land, poorly managed water, and weak project maintenance can affect food production, community safety and livelihoods.",
  sections:[
   {heading:"What is ACReSAL?",body:"ACReSAL stands for Agro-Climatic Resilience in Semi-Arid Landscapes. The programme supports landscape management, climate resilience and stronger institutions and communities. The exact activities in your community depend on approved state plans; a photo or map marker does not itself prove a completed project."},
   {heading:"What is an environmental intervention?",body:"An intervention is an organized action to address a problem, such as restoring degraded land, managing water, reducing erosion or supporting a community-managed asset. It should have a known location, responsible team, purpose and a way to check its condition after implementation."},
   {heading:"Why involve citizens?",body:"People who live near an intervention may notice early warning signs that are missed between formal inspections. They can report damage, join agreed maintenance work, learn safe practices and help ensure that issues reach the responsible staff. Technical repairs remain the duty of qualified personnel."},
   {heading:"How CARE-Map fits in",body:"CARE-Map provides a map, location-based records, a report form and educational lessons. It helps connect observations to a geographical place and review workflow. It does not replace official project registers, field verification or approval by ACReSAL management."}
  ],
  example:{title:"A borehole stops supplying water",body:"Residents notice a faulty hand pump and report its location and symptoms without trying to dismantle it. The responsible team checks the record, inspects the site and decides whether repair is needed. The community then receives suitable maintenance guidance."},
  actions:["Find out which organization is responsible for an intervention before raising a maintenance request.","Attend official community consultations and share observations, not rumours.","Report site damage using a clear description and verified location when safe.","Keep evidence factual and respect the privacy of community members."],
  avoid:"Do not assume that every facility shown on a map was built or funded by ACReSAL; verify its official project record.",
  remember:"An intervention needs monitoring, maintenance and community participation, not just a commissioning ceremony.",
  terms:[{term:"Resilience",definition:"The ability to prepare for, cope with and recover from stresses."},{term:"Intervention",definition:"A planned action or project addressing an identified issue."}],
  question:"Which statement best describes community participation?",
  choices:["Citizens independently repair unsafe equipment","Citizens observe, report and support approved maintenance","Construction ends all responsibility"],
  correct:1,source:{name:"ACReSAL programme",url:"https://acresal.gov.ng/"}
 },
 {
  id:"climate",category:"Climate & weather",graphic:"climate",
  title:"Climate change, weather and everyday decisions",level:"Everyday basics",minutes:8,
  summary:"Learn the difference between today's weather and long-term climate, and why adaptation matters to farms, water and health.",
  why:"Heat, rainfall patterns and extreme events affect people differently. Understanding risk helps communities plan instead of reacting only after damage occurs.",
  sections:[
   {heading:"Weather is not the same as climate",body:"Weather describes short-term conditions such as today's rain, sunshine, temperature and wind. Climate describes patterns and their variations over many years. One unusual storm or hot afternoon alone cannot establish a climate trend."},
   {heading:"How climate change can affect Benue communities",body:"Changes in heat, the timing and intensity of rainfall and water availability can influence crops, soil, drainage, flooding and everyday activities. The type and severity of risk vary by locality, season and people's ability to prepare."},
   {heading:"Mitigation and adaptation",body:"Mitigation means reducing the causes of climate change, such as unnecessary emissions. Adaptation means preparing for consequences, for example improving warnings, keeping drainage routes clear and selecting suitable local farm practices. Communities often need both."},
   {heading:"Where decisions should come from",body:"Use official forecasts, extension officers and emergency-management advice for time-sensitive decisions. General online articles cannot predict rainfall for a particular village or replace a local safety announcement."}
  ],
  example:{title:"Rain starts later than usual",body:"A farming household notices a delayed rainy season. Rather than relying on one person's memory, they consult seasonal guidance and an extension officer before changing planting dates or seed choices."},
  actions:["Follow official seasonal forecasts and severe-weather warnings.","Discuss crop timing and water planning with an extension officer.","Identify people who may need extra help during extreme heat or flooding.","Protect suitable green cover and avoid blocking natural water routes."],
  avoid:"Do not treat a single day's weather as proof of a long-term climate trend.",
  remember:"Weather changes day to day; climate is a long-term pattern. Adaptation is preparation, not prediction.",
  terms:[{term:"Climate adaptation",definition:"Actions that reduce harm from climate-related changes."},{term:"Climate mitigation",definition:"Actions that limit greenhouse gas emissions or enhance their removal."}],
  question:"What is the best response to an unusual rainy season?",
  choices:["Make all decisions from one afternoon's weather","Consult official forecasts and locally qualified advice","Assume every year will be identical"],
  correct:1,source:{name:"United Nations – Climate action and adaptation",url:"https://www.un.org/climatechange/what-is-climate-change/"}
 },
 {
  id:"flood",category:"Water & floods",graphic:"flood",
  title:"Flood preparedness: before, during and after",level:"Safety first",minutes:9,
  summary:"Recognize flood risks, prepare safe movement and understand what never to do in moving floodwater.",
  why:"Flooding can destroy property and block safe routes. Early warnings and organized evacuation protect lives more effectively than last-minute improvisation.",
  sections:[
   {heading:"Before heavy rain",body:"Identify places that have flooded before, low-lying routes, blocked drainage and people who may need help moving. Keep emergency contact information, essential medicines and documents accessible when there is an official flood warning."},
   {heading:"When a warning is issued",body:"Follow NEMA, relevant state emergency authorities and locally communicated instructions. Know a safe route to higher ground. If authorities advise evacuation, act early rather than waiting to see floodwater at your door."},
   {heading:"During flooding",body:"Do not walk, swim or drive through floodwater. Water can be deeper or faster than it appears, and it may hide broken roads, sharp objects, contaminated material or live electricity. Move away from floodwater and seek official assistance."},
   {heading:"After the water recedes",body:"Avoid entering unsafe buildings or handling exposed electrical equipment. Water supplies may be contaminated. Ask the relevant authorities about safe re-entry, cleanup and potable water before returning to normal activity."}
  ],
  example:{title:"A low road begins to flood",body:"A household hears a flood advisory. They use a previously agreed alternative route to safer higher ground and inform a trusted community contact. They do not attempt to cross the flooded section in a car."},
  actions:["Know your community's official emergency contacts and nearby safer ground.","Keep drainage clear of rubbish without entering dangerous flowing water.","Support neighbours who need help while following responder instructions.","Report blocked roads and hazards to the appropriate authorities."],
  avoid:"Never cross floodwater on foot or by vehicle; avoid contact with exposed electrical wiring.",
  remember:"Heed official flood warnings early. Turn away from floodwater.",
  terms:[{term:"Early warning",definition:"Information issued ahead of a possible hazard so people can prepare."},{term:"Evacuation",definition:"Moving people away from a dangerous area to a safer place."}],
  question:"A road is covered by moving floodwater. What should you do?",
  choices:["Drive through if other vehicles are moving","Turn away and use an officially advised safe route","Walk across to test how deep it is"],
  correct:1,source:{name:"NEMA Nigeria – Flood safety and preparedness",url:"https://nema.gov.ng/dg-nema-urges-residents-in-flood-prone-communities-to-heed-warning-alerts-relocate-to-safe-locations/"}
 },
 {
  id:"erosion",category:"Land & soil",graphic:"erosion",
  title:"Soil erosion: what causes it and how to respond",level:"On the ground",minutes:8,
  summary:"See how rain and runoff remove unprotected soil, what makes gullies worse, and practical ways to protect land.",
  why:"Loss of topsoil can reduce farm productivity and damage drainage, houses, roads and streams.",
  sections:[
   {heading:"How erosion begins",body:"Raindrops can loosen exposed soil. Flowing surface water may then transport soil downhill, especially where vegetation is missing or runoff is concentrated. Wind can also remove dry bare soil."},
   {heading:"Why small channels become serious",body:"Small erosion channels may deepen after repeated rainfall if water continues along the same route. On steep or unstable ground, larger gullies can threaten roads and structures. Do not stand at the edge of a growing gully."},
   {heading:"What usually reduces the risk",body:"Appropriate ground cover, contour-sensitive farming, healthy soil structure and well-designed drainage can help reduce erosion. These measures must match local soils, rainfall and slope. Incorrectly dug drains may shift flooding or erosion onto another property."},
   {heading:"When expert help is needed",body:"Report active gullies, undermined roads and erosion near buildings. Qualified engineers and extension officers should determine safe drainage or earthworks; community members should not improvise major structural repairs."}
  ],
  example:{title:"Two neighbouring plots",body:"One plot has exposed soil and runoff channels; the other retains suitable crop residues and vegetation cover. During heavy rain, ground cover can help slow surface flow, but the appropriate solution still depends on slope and drainage conditions."},
  actions:["Maintain suitable living or organic soil cover after consulting local extension guidance.","Keep rubbish out of roadside and household drains.","Photograph and safely report expanding gullies with location details.","Seek technical advice before redirecting runoff or cutting channels."],
  avoid:"Do not enter unstable gullies or direct stormwater toward houses and neighbouring farms.",
  remember:"Covering soil and managing runoff early are usually easier than repairing severe erosion.",
  terms:[{term:"Topsoil",definition:"The upper, biologically active soil layer important for plant growth."},{term:"Runoff",definition:"Rainwater flowing over land rather than soaking into it."}],
  question:"Which practice can help reduce erosion on exposed farmland?",
  choices:["Leave the soil permanently bare","Keep appropriate soil cover and seek slope-specific advice","Cut drainage channels toward nearby houses"],
  correct:1,source:{name:"FAO – Soil organic cover",url:"https://www.fao.org/conservation-agriculture/overview/conservation-agriculture-principles/en/"}
 },
 {
  id:"water",category:"Water & floods",graphic:"water",
  title:"Safe water points, boreholes and drainage",level:"Community practice",minutes:8,
  summary:"Understand routine water-point care, what to report and why drainage and drinking-water safety must be treated separately.",
  why:"Unrepaired water points disrupt everyday life. Poor drainage and unsafe water handling can increase health and environmental risks.",
  sections:[
   {heading:"What routine care means",body:"A community water point benefits from an agreed maintenance contact, cleanliness around the facility, safe access and prompt reporting of leaks or unusual pump behaviour. Operation and repairs must follow the responsible agency's guidance."},
   {heading:"Drainage and flooding",body:"Drainage channels guide rainwater away from roads and buildings when correctly designed and maintained. Rubbish, sediment and poorly located obstructions may prevent flow. Clearing deep or fast-moving channels is unsafe for untrained residents."},
   {heading:"A working pump does not guarantee safe drinking water",body:"Clear-looking water can still be unsafe. Water quality requires appropriate testing and public-health advice. Do not announce that a source is safe to drink based only on appearance, taste or a functional borehole pump."},
   {heading:"How to report a defect",body:"Describe the facility, nearest landmark and issue: for example no water, a leak, damaged drainage, exposed wiring or suspicious water quality. Add location and a non-sensitive photo only when safe. Responsible teams should assess technical and health concerns."}
  ],
  example:{title:"A pump gives cloudy water",body:"Residents stop treating normal pump operation as evidence of water safety. They notify the appropriate water-service or public-health authority and follow official advice on alternative safe water while the issue is assessed."},
  actions:["Keep the water-point surroundings clean without opening dangerous equipment.","Report broken equipment, leaking pipes and changes in water quality.","Follow public-health advice on water testing, treatment and storage.","Agree a community contact who can coordinate authorized maintenance visits."],
  avoid:"Do not touch exposed electrical equipment or drink suspicious water merely because the pump is working.",
  remember:"A functional water point and a safe drinking-water source are not necessarily the same thing.",
  terms:[{term:"Water quality",definition:"Physical, chemical and biological properties used to assess whether water is suitable for a purpose."},{term:"Preventive maintenance",definition:"Planned checks and care intended to reduce failures."}],
  question:"A borehole is working, but its water looks unusual. What next?",
  choices:["Assume it is safe because the pump works","Report for water-quality assessment and follow official guidance","Repair electrical components yourself"],
  correct:1,source:{name:"WHO – Drinking-water facts and safety",url:"https://www.who.int/news-room/fact-sheets/detail/drinking-water"}
 },
 {
  id:"watershed",category:"Water & floods",graphic:"watershed",
  title:"Watersheds, rivers and connected communities",level:"Understand the landscape",minutes:7,
  summary:"Learn why water flowing uphill-to-downhill can connect farms, settlements, river banks and drainage works.",
  why:"A change in one part of a drainage basin can affect water flow and sediment elsewhere; location matters for planning and reporting.",
  sections:[
   {heading:"What is a watershed?",body:"A watershed, or drainage basin, is an area of land where rainfall and runoff drain toward a common river, stream or outlet. It can cover many communities and local government areas."},
   {heading:"Upstream and downstream",body:"Activities higher in the watershed may affect areas farther downstream. For example, heavy runoff can carry soil or waste into channels, increasing sediment and sometimes blocking drainage. Actual impacts require field and hydrological investigation."},
   {heading:"Why rivers must be mapped carefully",body:"A river line on a digital map is a representation of a watercourse, not a live flood boundary. River position, seasonal flow and the accuracy of imported geometry affect conclusions. Small streams may be missing from available datasets."},
   {heading:"Planning together",body:"Water and land management works best when nearby communities, farmers and responsible government teams understand how a change in one location may affect others. Major river engineering and flood-control works require qualified assessment."}
  ],
  example:{title:"Waste enters a stream upstream",body:"Rain carries dumped waste from an upper neighbourhood into a waterway used farther downstream. Reporting the location of blockage and communicating across communities helps officials decide where investigation should begin."},
  actions:["Keep rubbish away from drains, streams and riverbanks.","Report new erosion or blocked water channels with precise landmarks.","Learn which local waterways connect your community to downstream areas.","Refer major riverbank works to competent technical teams."],
  avoid:"Do not treat a river buffer on CARE-Map as a certified flood-hazard forecast.",
  remember:"Land and water are connected across community boundaries.",
  terms:[{term:"Watershed",definition:"The land area draining toward a common water outlet."},{term:"Upstream",definition:"Toward where water flows from; downstream is toward where it flows to."}],
  question:"Why could a problem upstream matter to a downstream community?",
  choices:["Water systems are always isolated","Water and sediment can travel through connected channels","Streams do not move soil"],
  correct:1,source:{name:"USGS – Watersheds and drainage basins",url:"https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins"}
 },
 {
  id:"trees",category:"Trees & farming",graphic:"trees",
  title:"Tree planting is only the beginning",level:"Restoration basics",minutes:8,
  summary:"Learn what healthy landscape restoration involves and why seedling survival and follow-up matter more than planting-day totals.",
  why:"Vegetation can help protect soils and support landscapes, but species selection and long-term management are essential.",
  sections:[
   {heading:"Restoration versus planting",body:"Landscape restoration aims to improve the condition and function of degraded land. Planting seedlings can be one part of this work; other approaches include protecting natural regeneration, reducing destructive disturbance and managing water appropriately."},
   {heading:"Match the species to the site",body:"Trees differ in their water needs, root systems and compatibility with local farming or ecosystems. Forestry and extension professionals should advise on locally appropriate species and planting locations, including avoiding utilities and hazardous sites."},
   {heading:"What happens after planting?",body:"Check whether seedlings survive, whether protective measures are working and whether pests, grazing, fire or dry conditions threaten young plants. Record observations during follow-up visits rather than relying on opening-day photographs."},
   {heading:"How to interpret success",body:"Counting planted seedlings measures an activity; survival, site condition and ecological recovery are more meaningful outcomes. These indicators should be assessed over time and checked against suitable reference conditions."}
  ],
  example:{title:"A planting site after six months",body:"A team that planted many seedlings returns to find some lost to grazing and drought. They record the surviving plants, discuss protective measures and plan follow-up instead of reporting the original planting number as the final result."},
  actions:["Follow qualified local guidance on species selection and site suitability.","Help protect approved restoration sites from uncontrolled fire or grazing where appropriate.","Record survival and visible damage on agreed monitoring dates.","Share factual observations with a forestry or extension officer."],
  avoid:"Do not equate an increase in NDVI with proof that planted trees caused the change.",
  remember:"Restoration success is about ecological improvement and survival over time, not a one-day planting total.",
  terms:[{term:"Restoration",definition:"Assisting the recovery of degraded land or ecosystems."},{term:"Survival rate",definition:"The proportion of originally planted seedlings still living at a later check."}],
  question:"What is a better measure than the number of seedlings planted?",
  choices:["How many photos were taken","Survival and site condition recorded over time","The length of the opening ceremony"],
  correct:1,source:{name:"FAO – Forest and landscape restoration",url:"https://www.fao.org/in-action/forest-landscape-restoration-mechanism/en/"}
 },
 {
  id:"farming",category:"Trees & farming",graphic:"farming",
  title:"Climate-smart farming and soil protection",level:"On the farm",minutes:9,
  summary:"Explore soil cover, careful soil disturbance and crop diversification as locally adaptable farming practices.",
  why:"Protecting soil and managing water can help farmers maintain land resources, but practices must suit specific fields, labour conditions and crops.",
  sections:[
   {heading:"Protect the soil surface",body:"Suitable crop residues, mulch or living cover can reduce direct raindrop impact and help conserve soil moisture. Residues must be assessed for competing uses, pests, fire risk and local conditions."},
   {heading:"Disturb soil only as needed",body:"Repeated intensive disturbance can disrupt soil structure and leave bare surfaces vulnerable to erosion. Reduced tillage or direct planting may be useful where suited to the soil, tools and weed-management plan."},
   {heading:"Grow a sensible mix over time",body:"Rotating crops or combining compatible species may help diversify risk, manage some pests and support soil health. The right combination depends on rainfall, market requirements, soil type and access to inputs."},
   {heading:"Ask before copying a practice",body:"An approach that works on one farm may fail on another with different slope, rainfall, drainage or soil. Consult local extension guidance, start with a manageable trial and observe the results."}
  ],
  example:{title:"Maize and legumes on a small plot",body:"A farmer discusses a possible cereal–legume rotation with an extension worker and chooses a field trial. They observe soil cover, crop condition and practical costs rather than assuming that any rotation automatically improves yields."},
  actions:["Discuss suitable residue retention, soil cover and crop rotation with an extension officer.","Observe field slope, runoff and soil condition before changing practices.","Avoid burning residues by default when suitable safer soil-cover options exist.","Compare changes over multiple seasons, not just one harvest."],
  avoid:"Do not make fertiliser, pesticide or irrigation decisions solely from a general website lesson.",
  remember:"Conservation agriculture rests on soil cover, minimal soil disturbance and diverse cropping, adapted locally.",
  terms:[{term:"Mulch",definition:"Material laid over soil to help protect its surface."},{term:"Crop rotation",definition:"Changing the crop species grown in a field over seasons."}],
  question:"Which set represents key conservation-agriculture principles?",
  choices:["Bare soil, repeated burning and the same crop every year","Soil cover, low disturbance and crop diversification","Unplanned drainage and continuous tillage"],
  correct:1,source:{name:"FAO – Conservation agriculture principles",url:"https://www.fao.org/conservation-agriculture/overview/conservation-agriculture-principles/en/"}
 },
 {
  id:"ndvi",category:"GIS & satellite",graphic:"ndvi",
  title:"Read CARE-Map's vegetation-change results",level:"Map reading",minutes:9,
  summary:"Understand NDVI, satellite comparison dates, green/orange change symbols and why a community name is not proof of restoration.",
  why:"Satellite estimates are useful for screening vegetation conditions, but their meaning depends on the time periods, data quality and geographical boundary used.",
  sections:[
   {heading:"What is NDVI?",body:"The Normalized Difference Vegetation Index compares near-infrared light reflected by plants with red light. Green leaves often absorb red light and reflect more near-infrared light, allowing satellite imagery to indicate vegetation greenness. NDVI ranges from -1 to +1 and is not a direct tree count."},
   {heading:"What exactly does CARE-Map compare?",body:"The system uses Sentinel-2 observations in a chosen baseline window and a later comparison window. It estimates vegetated area using an NDVI threshold. The published coloured polygon summarises the whole selected area of interest, called an AOI, rather than showing the position of every tree that changed."},
   {heading:"What do the colours mean?",body:"A green analysis polygon indicates an estimated increase in vegetation-area coverage between the selected periods; orange indicates an estimated decrease. Grey means unchanged or unavailable depending on the displayed legend. Always read the dates, area in hectares, percentage and quality notes."},
   {heading:"Why dates and clouds matter",body:"Comparing a rainy-season period with a dry-season period can show normal seasonal differences rather than long-term land recovery. Clouds and shadows can hide land. CARE-Map applies minimum clear-pixel checks, but an acceptable software quality score is not independent scientific verification."},
   {heading:"Community, LGA and state attribution",body:"An AOI may overlap a known LGA or have a mapped settlement nearby. These labels explain where the analysis was performed. They do not turn an AOI-wide estimate into a verified change for every nearby community. Accurate community totals require reliable area boundaries and properly clipped analyses."}
  ],
  example:{title:"A published result says +150 hectares",body:"This means the software estimated about 150 more hectares above its selected vegetation threshold within the particular AOI and periods. It does not mean 150 hectares of trees were planted, that exactly 150 hectares were restored, or that ACReSAL caused the change."},
  actions:["Check baseline and comparison dates and whether they use comparable seasons.","Read the hectares and percentage beside the coloured AOI.","Inspect cloud/clear-pixel quality and whether the area is approved for publication.","Ask for field verification before reporting success or decline as a programme outcome."],
  avoid:"Never treat a green NDVI polygon alone as proof that a particular project caused land recovery.",
  remember:"Green means estimated vegetation gain; orange means estimated loss. Compare similar seasons and verify on the ground.",
  terms:[{term:"NDVI",definition:"A satellite-derived index of vegetation greenness calculated from red and near-infrared light."},{term:"AOI",definition:"Area of Interest: the geographic boundary selected for analysis."},{term:"Hectare",definition:"An area of 10,000 square metres."}],
  question:"What does a green NDVI analysis polygon prove?",
  choices:["Every tree inside it is newly planted","The selected AOI has an estimated increase for the specified periods","An ACReSAL intervention definitely caused the change"],
  correct:1,source:{name:"NASA – Measuring vegetation: NDVI",url:"https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/"}
 },
 {
  id:"reporting",category:"Community action",graphic:"report",
  title:"Report an environmental problem responsibly",level:"Using CARE-Map",minutes:7,
  summary:"Learn what belongs in a useful community report, how to give a location and why private information should be protected.",
  why:"Accurate and proportionate reports make it easier for responsible teams to identify an issue, while vague or duplicate claims can waste limited field time.",
  sections:[
   {heading:"Start with what you personally observed",body:"State what happened, where it happened and when you noticed it. Separate facts from rumours or suspected causes. For example, 'the pump handle is loose' is clearer than 'the project was abandoned' when the only observation is a damaged handle."},
   {heading:"Provide the safest useful location",body:"Use GPS when it works reliably, or carefully enter coordinates and nearby landmarks. Review the map position before submitting. A device's stated GPS accuracy is an estimate and may require a field check."},
   {heading:"Photos and personal privacy",body:"Only take images where it is safe and appropriate. Avoid faces, children's details, identity documents, private homes and telephone numbers unless the reporting process explicitly requires and protects them. Never enter sensitive information in public free-text fields."},
   {heading:"What happens next?",body:"A report can be reviewed, assigned or investigated by authorized staff using the platform's workflow. Submission is not itself proof that a repair has been accepted, funded or completed. If offline, verify that a queued report was actually synchronized."}
  ],
  example:{title:"A blocked drainage near a road",body:"A citizen reports the nearest safe landmark, approximate location, visible obstruction and time noticed. They do not enter floodwater for a better photograph. Emergency danger is also reported to the appropriate authority directly."},
  actions:["Describe the observable issue in simple factual language.","Add a safe location and only necessary non-sensitive evidence.","Keep your report reference to support follow-up.","For urgent danger, use official emergency channels rather than waiting for website review."],
  avoid:"Do not upload someone else's private information or risk injury to obtain photographs.",
  remember:"A good report is specific, safe, factual and respectful of privacy.",
  terms:[{term:"GPS",definition:"Satellite-based technology that can estimate a device's position."},{term:"Verification",definition:"Checking whether reported information is supported by reliable evidence."}],
  question:"What makes a useful community report?",
  choices:["An unverified rumour and someone's private phone number","A clear observation, useful location and safe evidence","A dramatic claim without a location"],
  correct:1,source:{name:"ACReSAL Nigeria – Public programme information",url:"https://acresal.gov.ng/"}
 },
 {
  id:"waste",category:"Community action",graphic:"waste",
  title:"Waste, blocked drains and a cleaner environment",level:"Neighbourhood practice",minutes:7,
  summary:"See how dumped refuse affects drainage and community surroundings, and learn safer collective prevention.",
  why:"Blocked drainage can worsen local ponding and runoff. Waste also creates nuisance and may enter streams used by other communities.",
  sections:[
   {heading:"How drainage becomes blocked",body:"Plastic bags, soil, branches and solid waste can gather at culverts and drains. Rainwater may then be diverted, flow over roads, or erode nearby ground. The local effect depends on the drainage design and rainfall."},
   {heading:"Why waste disposal is a community responsibility",body:"Preventing blockage begins before heavy rain. Sensible collection and designated disposal are generally safer and more effective than waiting until a waterway becomes clogged. Community cleanups should be organized with competent local authorities."},
   {heading:"Recognize unsafe cleanup conditions",body:"Never climb into a deep drain, enter moving water, handle suspected chemicals or touch exposed cables. Some blockages need trained sanitation or drainage crews and suitable equipment."},
   {heading:"How to track improvement",body:"Keep records of reported blockages, cleanups, recurring locations and official follow-up. Photographs taken safely from public areas can help show a change, but should not expose people unnecessarily."}
  ],
  example:{title:"The same culvert blocks after each storm",body:"Residents map the trouble spot, report recurring refuse accumulation and work through their local authority to improve waste collection and maintenance, rather than repeatedly climbing into the flooded channel."},
  actions:["Use authorized waste disposal routes.","Help keep accessible dry-area drains free from litter where safe and permitted.","Report blocked culverts and recurring dumping locations.","Encourage community cleanup planning with local sanitation staff."],
  avoid:"Do not enter enclosed drainage channels, floodwater or areas containing unknown waste.",
  remember:"Preventing rubbish from entering drains is safer than clearing dangerous blockages during rain.",
  terms:[{term:"Culvert",definition:"A structure that lets water pass under a road or path."},{term:"Sediment",definition:"Soil and other small particles carried and deposited by water."}],
  question:"What is a safer way to manage a blocked flood drain?",
  choices:["Enter the rushing water to clear it alone","Report it and coordinate authorized maintenance","Push all waste downstream"],
  correct:1,source:{name:"NEMA Nigeria – Flood preparedness advice",url:"https://nema.gov.ng/dg-nema-urges-residents-in-flood-prone-communities-to-heed-warning-alerts-relocate-to-safe-locations/"}
 },
 {
  id:"warning",category:"Climate & weather",graphic:"warning",
  title:"Understanding official warnings and acting early",level:"Safety first",minutes:7,
  summary:"Learn how to recognize a warning, make a household plan and avoid sharing unreliable emergency information.",
  why:"Timely decisions depend on trusted information, practical routes and support for people at greater risk.",
  sections:[
   {heading:"Forecast, watch and warning",body:"A forecast describes expected conditions. A watch or advisory can indicate the possibility of hazardous conditions, while a warning signals a more urgent threat according to the issuing agency's definitions. Always read the full message and the place and time it applies to."},
   {heading:"Who should you trust?",body:"Use announcements from recognized meteorological, emergency-management and local authorities. Verify forwarded messages before resharing them, especially when they include specific evacuation instructions or unverified emergency numbers."},
   {heading:"Make a simple household plan",body:"Agree on safer routes, where to meet, emergency supplies and how to assist children, older people and those who need mobility support. Check the plan before a hazard season instead of improvising at the last moment."},
   {heading:"What CARE-Map can and cannot do",body:"CARE-Map may help describe the location of a reported concern, but it is not a substitute for official real-time flood forecasts, public warnings, emergency dispatch or rescue services."}
  ],
  example:{title:"A flood warning is shared in a group chat",body:"Rather than forwarding it automatically, a resident checks the issuing authority, area and date. If genuine and relevant, the household follows the official safety advice and helps vulnerable neighbours prepare safely."},
  actions:["Check the date, place and issuing authority of any warning.","Plan safer routes and family communication before hazards occur.","Follow official evacuation instructions promptly.","Use approved emergency channels for urgent danger."],
  avoid:"Do not treat unverified social-media messages as official evacuation instructions.",
  remember:"The best warning is one you verify, understand and act on safely.",
  terms:[{term:"Hazard",definition:"An event or condition with potential to cause harm."},{term:"Preparedness",definition:"Steps taken before an event to reduce its harmful effects."}],
  question:"You receive an alarming flood message with no source. What comes first?",
  choices:["Forward it immediately as confirmed","Verify the issuing authority, place and date","Ignore every warning forever"],
  correct:1,source:{name:"NEMA Nigeria – Official flood preparedness",url:"https://nema.gov.ng/dg-nema-urges-residents-in-flood-prone-communities-to-heed-warning-alerts-relocate-to-safe-locations/"}
 }
];

export const categoryDescriptions:Record<CitizenCategory,string>={
 "Getting started":"Understand ACReSAL and community responsibilities.",
 "Climate & weather":"Understand changing conditions and prepare for hazards.",
 "Land & soil":"Protect the ground beneath farms, roads and homes.",
 "Water & floods":"Care for waterways, water points and safer communities.",
 "Trees & farming":"Support healthy vegetation and locally suitable farming.",
 "GIS & satellite":"Make sense of maps and satellite vegetation estimates.",
 "Community action":"Report concerns and practise responsible stewardship."
};
