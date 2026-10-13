import Link from "next/link";
export const metadata={title:"ACReSAL Community Extension | CARE-Map",
 description:"Community aftercare and extension guidance for projects mapped in CARE-Map."};

export default function ExtensionPage(){
  return <div className="stack">
    <section className="card stack">
      <div className="muted">CARE-Map · Community extension</div>
      <h1>Protecting projects together</h1>
      <p>Local communities play a vital role in the long-term care of boreholes, restored landscapes, erosion-control works and other interventions. This page explains the CARE-Map extension workflow and how community members can report an issue for field follow-up.</p>
      <div className="actions">
        <Link className="btn primary" href="/report">Report a project problem</Link>
        <Link className="btn" href="/">See the public project map</Link>
      </div>
    </section>
    <section className="grid three">
      <div className="card stack"><h2>Community focal persons</h2><p>Each intervention has a consenting community representative who can coordinate maintenance visits and raise concerns. Personal telephone numbers are never published on this page.</p></div>
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