import Link from "next/link";
import CitizenLearningCenter from "@/components/CitizenLearningCenter";
export const metadata={title:"ACReSAL Community Extension | CARE-Map",
 description:"Free illustrated citizen education in climate, flood safety, soil erosion, water, farming, remote sensing and community stewardship."};

export default function ExtensionPage(){
  return <div className="stack">
    <section className="card stack">
      <span className="page-eyebrow">CARE-Map · Citizen education & community extension</span>
      <h1>ACReSAL community extension and environmental learning</h1>
      <p>Explore illustrated, practical lessons about climate change, flooding, soil and water care, resilient farming, satellite vegetation maps and responsible reporting. Each lesson includes clear explanations, a community example, a glossary and a knowledge check.</p>
      <div className="actions">
        <Link className="btn primary" href="/report">Report a project problem</Link>
        <a className="btn" href="#community-lessons">Start learning</a>
        <Link className="btn" href="/#public-map">Explore the vegetation map</Link>
      </div>
    </section>
    <div id="community-lessons" className="gis-section"><CitizenLearningCenter/></div>
    <section className="grid three">
      <div className="card stack"><h2>Community focal persons</h2><p>Each intervention has a consenting community representative who can coordinate maintenance visits and raise concerns. Private contact numbers are not published here.</p></div>
      <div className="card stack"><h2>Extension support</h2><p>Field teams document inspections, practical guidance, local training and follow-up actions so maintenance issues are not lost between visits.</p></div>
      <div className="card stack"><h2>Care & stewardship</h2><p>Communities managing similar project types can be assessed against the same published criteria. Assessments require evidence and independent review.</p></div>
    </section>
    <section className="card stack">
      <h2>How the community competition works</h2>
      <p>Comparable projects are assessed for regular maintenance (35%), functionality (30%), site condition and cleanliness (15%), and community participation (20%). The scores are evidence-based and subject to an independent review.</p>
      <p>Eligible communities may be considered for additional project support, subject to technical need, fairness, budgets and formal ACReSAL approval. A competition ranking does not automatically award a project.</p>
      <p className="muted">Community contact details, raw assessment evidence and unapproved project proposals remain staff-only.</p>
    </section>
    <section className="card stack"><h2>Need assistance?</h2>
      <p>Use the CARE-Map reporting workflow to describe a maintenance problem and identify its location. An authorized field team can review it and arrange follow-up. Do not submit private telephone numbers or sensitive photos in public text fields.</p>
      <Link className="btn primary" href="/report">Submit a community report</Link>
    </section>
  </div>;
}