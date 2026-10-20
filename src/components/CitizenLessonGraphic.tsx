import type {LessonGraphic} from "@/lib/citizen-lessons";

/** Self-contained, lightweight, accessible vector teaching graphics.
 * Illustrations are conceptual, not actual satellite maps or survey evidence.
 */
export default function CitizenLessonGraphic({kind,title}:{kind:LessonGraphic;title:string}){
 const text=(x:number,y:number,label:string,anchor:"start"|"middle"="start")=>
   <text x={x} y={y} textAnchor={anchor} fontSize="13" fontWeight="700"
     fill="#284b3c" fontFamily="system-ui, sans-serif">{label}</text>;
 const tree=(x:number,y:number,scale=1)=><g transform={`translate(${x} ${y}) scale(${scale})`}>
   <rect x="-5" y="-42" width="10" height="47" rx="2" fill="#8e6245"/>
   <circle cx="-18" cy="-45" r="21" fill="#41976c"/>
   <circle cx="14" cy="-52" r="23" fill="#257b54"/>
   <circle cx="-2" cy="-67" r="21" fill="#61ac72"/>
 </g>;
 const cloud=(x:number,y:number)=><g fill="#fff" stroke="#bedbd3" strokeWidth="2">
   <rect x={x-44} y={y} width="100" height="31" rx="16"/>
   <circle cx={x-15} cy={y-8} r="22"/><circle cx={x+24} cy={y-11} r="26"/>
 </g>;
 const water=(x:number,y:number,width:number)=><g stroke="#2989aa" strokeWidth="3" fill="none" strokeLinecap="round">
   {[0,16,32].map(n=><path key={n} d={`M${x} ${y+n} q18 -10 36 0 t36 0 t36 0 t36 0 t36 0`}/>)}
   <rect x={x-2} y={y-14} width={width} height="56" fill="#bce5ed" opacity=".36" stroke="none"/>
 </g>;
 return <div className={"citizen-graphic citizen-graphic-"+kind}>
  <svg viewBox="0 0 600 210" role="img"
    aria-label={"Illustrative learning diagram for "+title}
    xmlns="http://www.w3.org/2000/svg">
   <title>{title}: conceptual illustration</title>
   <rect width="600" height="210" rx="18" fill="#e9f4ed"/>
   <circle cx="515" cy="44" r="31" fill="#f3c86d"/>
   {kind==="overview"&&<>
    <path d="M0 150 Q90 104 188 142 T388 140 T600 135 V210 H0Z" fill="#afd7af"/>
    <path d="M0 177 Q180 160 245 179 T600 170 V210 H0Z" fill="#7fbb89"/>
    <path d="M270 210 Q315 178 355 158 T425 145" fill="none" stroke="#48a7c0" strokeWidth="22"/>
    {tree(115,166,1.1)}{tree(520,171,.85)}
    <path d="M220 174 V113 L255 91 L290 113 V174Z" fill="#fbefd1" stroke="#60836c" strokeWidth="3"/>
    <path d="M213 115 L255 81 L298 115" stroke="#936e4c" strokeWidth="8" fill="none"/>
    {text(93,32,"LAND")}{text(240,60,"COMMUNITIES")}{text(425,113,"WATER")}
   </>}
   {kind==="climate"&&<>
    <path d="M0 160 Q130 137 260 160 T600 157 V210 H0Z" fill="#b8dcb9"/>
    {cloud(128,56)}
    {[0,1,2,3].map(i=><path key={i} d={`M${95+i*25} 102 l-9 26`} stroke="#419dbd" strokeWidth="5" strokeLinecap="round"/>)}
    <g stroke="#d5893d" strokeWidth="6" fill="none">
     <path d="M402 72 V146"/><circle cx="402" cy="155" r="18" fill="#f2c675" stroke="none"/>
    </g>
    <rect x="391" y="55" width="22" height="106" rx="11" stroke="#bf853d" strokeWidth="4" fill="#fff2d1"/>
    <rect x="398" y="102" width="8" height="50" rx="4" fill="#d7874b"/>
    {text(124,150,"Rainfall")}{text(400,190,"Heat", "middle")}{text(300,36,"Weather patterns", "middle")}
   </>}
   {kind==="flood"&&<>
    <path d="M0 142 L218 148 L332 74 L600 62 V210 H0Z" fill="#b2d5b6"/>
    <path d="M0 170 Q70 156 135 177 T275 174 L275 210 H0Z" fill="#65b4cf" opacity=".85"/>
    {water(3,164,215)}
    <path d="M60 144 V110 L90 90 L120 110 V144Z" fill="#fff1d5" stroke="#7d8c72" strokeWidth="3"/>
    <path d="M52 112 L90 83 L128 112" fill="none" stroke="#a16d4d" strokeWidth="7"/>
    <path d="M420 108 V73 L458 48 L496 73 V108Z" fill="#fff1d5" stroke="#79927e" strokeWidth="3"/>
    <path d="M413 75 L458 42 L503 75" fill="none" stroke="#a16d4d" strokeWidth="7"/>
    <path d="M204 124 Q305 68 382 80" stroke="#276d55" strokeWidth="5" strokeDasharray="12 8" fill="none"/>
    <path d="M375 70 L391 77 L376 89" fill="none" stroke="#276d55" strokeWidth="5"/>
    {text(95,73,"Low ground","middle")}{text(472,139,"Safer high ground","middle")}
   </>}
   {kind==="erosion"&&<>
    <path d="M0 146 L150 95 L295 162 L445 95 L600 143 V210 H0Z" fill="#d3b28a"/>
    <path d="M0 145 L150 95 L215 125" fill="none" stroke="#9c7754" strokeWidth="5"/>
    <path d="M295 162 L445 95 L600 143" fill="none" stroke="#5a9c61" strokeWidth="11"/>
    {[330,360,398,437,474,510,544].map((x,i)=><path key={i} d={`M${x} ${145-Math.sin(i/6*Math.PI)*34} l-6 -20 m6 20 l7 -20`}
      stroke="#32804a" strokeWidth="4" fill="none"/>)}
    <path d="M165 120 Q145 146 183 167 T232 208" stroke="#ab6c42" strokeWidth="10" fill="none"/>
    {cloud(135,24)}
    {[0,1,2].map(i=><path key={i} d={`M${120+i*26} 77 l-6 24`} stroke="#4e9cbb" strokeWidth="5"/>)}
    {text(125,190,"Bare soil","middle")}{text(445,190,"Protected soil","middle")}
   </>}
   {kind==="water"&&<>
    <path d="M0 174 Q170 150 290 174 T600 169 V210 H0Z" fill="#a6d09f"/>
    <g transform="translate(185 70)">
      <rect x="-65" y="60" width="130" height="48" rx="9" fill="#dedad0" stroke="#8a9c98" strokeWidth="4"/>
      <path d="M-50 61 V18 Q0 -22 50 18 V61" fill="none" stroke="#60899b" strokeWidth="8"/>
      <rect x="-17" y="25" width="34" height="30" rx="7" fill="#8ac5d7"/>
      <path d="M0 0 V-18 H75 V19" fill="none" stroke="#62747b" strokeWidth="9"/>
      <path d="M74 18 q-7 16 0 24 q7 -8 0 -24Z" fill="#398eaf"/>
    </g>
    <path d="M348 170 L510 170 L545 188" fill="none" stroke="#7d8582" strokeWidth="16"/>
    <path d="M354 170 L510 170 L545 188" fill="none" stroke="#4aa5bb" strokeWidth="7"/>
    {text(186,40,"Water point","middle")}{text(455,134,"Drainage","middle")}
   </>}
   {kind==="watershed"&&<>
    <path d="M0 156 L115 65 L235 154 L330 74 L466 164 L550 114 L600 144 V210 H0Z" fill="#b7d1ad"/>
    <path d="M115 76 Q130 119 240 158 Q283 185 350 179 Q447 178 540 210" fill="none" stroke="#449ebb" strokeWidth="18"/>
    <path d="M329 86 Q340 119 285 156" fill="none" stroke="#6eb7cb" strokeWidth="12"/>
    {[180,265,408].map((x,i)=><g key={i} fill="none" stroke="#2e7c90" strokeWidth="4" strokeLinecap="round">
      <path d={`M${x} ${125+i*20} l18 13`}/><path d={`M${x+12} ${130+i*20} l6 8 l-10 0`}/>
    </g>)}
    {text(86,47,"Upstream")}{text(444,61,"Downstream")}
   </>}
   {kind==="trees"&&<>
    <path d="M0 166 Q300 149 600 166 V210 H0Z" fill="#a7cda2"/>
    {[95,250,432].map((x,i)=><g key={x}>
      <path d={`M${x} 170 v${-(25+i*17)}`} stroke="#865c3c" strokeWidth={7+i*2} strokeLinecap="round"/>
      <circle cx={x} cy={145-i*17} r={17+i*10} fill={["#85b765","#5cac67","#348d5e"][i]}/>
      <path d={`M${x} 172 l-18 12 M${x} 172 l17 12`} stroke="#9d7151" strokeWidth="3"/>
    </g>)}
    {text(95,200,"Seedling","middle")}{text(250,200,"Growing","middle")}{text(432,200,"Established","middle")}
    {text(300,39,"Follow-up matters","middle")}
   </>}
   {kind==="farming"&&<>
    {[0,1,2].map(i=><g key={i}>
      <rect x={60+i*174} y="67" width="143" height="120" rx="10" fill={["#deb982","#a2c881","#c9b27f"][i]}/>
      {[0,1,2,3].map(j=><path key={j} d={`M${77+i*174} ${95+j*22} H${186+i*174}`} stroke="#8a855e" strokeWidth="3" strokeDasharray="8 8"/>)}
    </g>)}
    {[0,1,2,3].map(i=><path key={i} d={`M${277+i*22} 125 v-22 m0 12 l-11 -8 m11 8 l11 -8`} stroke="#287e50" strokeWidth="4" fill="none"/>)}
    {text(130,54,"Soil cover","middle")}{text(305,54,"Crops","middle")}{text(478,54,"Rotation","middle")}
   </>}
   {kind==="ndvi"&&<>
    <rect x="40" y="55" width="197" height="130" rx="10" fill="#f9fbf6"/>
    <rect x="355" y="55" width="197" height="130" rx="10" fill="#f9fbf6"/>
    {[0,1,2,3].flatMap(i=>[0,1,2,3,4].map(j=><g key={i+"-"+j}>
      <rect x={51+j*35} y={68+i*27} width="30" height="23" rx="2"
        fill={["#c5a87b","#90b37b","#789f72","#beaa7e","#70a76b"][(j+i*3)%5]}/>
      <rect x={366+j*35} y={68+i*27} width="30" height="23" rx="2"
        fill={["#3c985c","#67a968","#8cba74","#c0a776","#4d9c63"][(j+i*2)%5]}/>
    </g>))}
    <path d="M255 118 H340 M327 105 L341 118 L327 131" fill="none" stroke="#31634d" strokeWidth="6" strokeLinecap="round"/>
    {text(140,39,"Baseline","middle")}{text(453,39,"Comparison","middle")}
    {text(300,201,"Illustrative vegetation index pixels","middle")}
   </>}
   {kind==="report"&&<>
    {[0,1,2].map(i=><rect key={i} x={65+i*184} y="52" width="135" height="127" rx="16"
      fill="#f7faf7" stroke="#8bb8a4" strokeWidth="4"/>)}
    <path d="M134 87 a25 25 0 1 1 -1 0" stroke="#2b8f74" strokeWidth="6" fill="none"/>
    <circle cx="134" cy="107" r="9" fill="#2b8f74"/>
    <path d="M307 78 l28 20 v32 l-28 24 l-28 -24 v-32Z" fill="#e2f3ed" stroke="#39886b" strokeWidth="4"/>
    <circle cx="307" cy="111" r="12" fill="#419e7f"/>
    <path d="M477 101 l16 16 l27 -31" stroke="#2e9365" strokeWidth="10" fill="none" strokeLinecap="round"/>
    {text(134,199,"Observe","middle")}{text(317,199,"Locate","middle")}{text(500,199,"Report","middle")}
   </>}
   {kind==="waste"&&<>
    <path d="M0 161 Q290 146 600 164 V210 H0Z" fill="#b3d4b4"/>
    <rect x="98" y="97" width="96" height="86" rx="9" fill="#4d9475"/>
    <path d="M91 95 H201" stroke="#2d6d59" strokeWidth="10" strokeLinecap="round"/>
    {[124,145,168].map(x=><path key={x} d={`M${x} 110 V165`} stroke="#cce6d4" strokeWidth="5"/>)}
    <path d="M288 173 H555 L575 195" fill="none" stroke="#858887" strokeWidth="23"/>
    <path d="M288 173 H555 L575 195" fill="none" stroke="#61b0c5" strokeWidth="12"/>
    <path d="M390 148 L430 185 M430 148 L390 185" stroke="#c05e46" strokeWidth="9" strokeLinecap="round"/>
    {text(146,70,"Use bins","middle")}{text(435,87,"Keep drains clear","middle")}
   </>}
   {kind==="warning"&&<>
    <path d="M140 43 L43 169 H237Z" fill="#f8d99a" stroke="#bc7c42" strokeWidth="7" strokeLinejoin="round"/>
    <path d="M140 89 V127 M140 150 v1" stroke="#a25934" strokeWidth="12" strokeLinecap="round"/>
    <rect x="295" y="57" width="248" height="115" rx="14" fill="#fff" stroke="#9cc6b5" strokeWidth="4"/>
    {[0,1,2].map(i=><g key={i}>
      <circle cx="325" cy={85+i*31} r="10" fill="#4caa7b"/>
      <path d={`M320 ${85+i*31} l4 5 l8 -11`} fill="none" stroke="#fff" strokeWidth="3"/>
      <path d={`M350 ${85+i*31} H${505-i*18}`} stroke="#94b9a7" strokeWidth="7" strokeLinecap="round"/>
    </g>)}
    {text(140,199,"Recognize","middle")}{text(412,199,"Verify · Plan · Act","middle")}
   </>}
  </svg>
  <p className="citizen-graphic-caption">Illustration for learning only. Not a surveyed map, forecast or documented project photograph.</p>
 </div>;
}
