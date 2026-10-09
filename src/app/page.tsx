import PublicMap from "@/components/PublicMap";
import HomeIntro from "@/components/HomeIntro";
import LocalizedMapHeading from "@/components/LocalizedMapHeading";

export default function Home(){
  return <div className="stack">
    <HomeIntro/>
    <section>
      <LocalizedMapHeading/>
      <PublicMap/>
    </section>
  </div>;
}
