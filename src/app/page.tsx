import PublicMap from "@/components/PublicMap";
import HomeIntro from "@/components/HomeIntro";
import LocalizedMapHeading from "@/components/LocalizedMapHeading";

export default function Home(){
  return <div className="stack" style={{gap:22}}>
    <HomeIntro/>
    <section id="public-map" className="stack gis-section">
      <LocalizedMapHeading/>
      <p className="muted" style={{margin:"-4px 0 0"}}>Use the filters to explore mapped interventions. Boundaries and satellite findings should be interpreted with their source and verification status.</p>
      <PublicMap/>
    </section>
  </div>;
}
