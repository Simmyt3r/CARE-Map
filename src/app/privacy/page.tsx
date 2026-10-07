import PrivacyRequestForm from "@/components/PrivacyRequestForm";
import {PRIVACY_NOTICE_VERSION} from "@/lib/privacy";

export const dynamic="force-dynamic";

export default function PrivacyPage(){
  const controller=process.env.DATA_CONTROLLER_NAME||"Benue ACReSAL / CARE-Map";
  const email=process.env.PRIVACY_CONTACT_EMAIL||"Privacy contact pending formal launch configuration";
  const address=process.env.DATA_CONTROLLER_ADDRESS||"Controller address pending formal launch configuration";
  const reportsBasis=process.env.PRIVACY_LAWFUL_BASIS_REPORTS||"Lawful basis pending formal legal review";
  const accountsBasis=process.env.PRIVACY_LAWFUL_BASIS_ACCOUNTS||"Lawful basis pending formal legal review";

  return <div className="stack privacy-page">
    <section className="card stack">
      <span className="badge">Privacy notice · version {PRIVACY_NOTICE_VERSION}</span>
      <h1>CARE-Map privacy notice</h1>
      <p>CARE-Map processes limited personal data so community members and staff can submit, follow up, verify, and manage environmental and infrastructure reports. This notice explains what is collected, why it is used, how long it is kept, and how to exercise your rights.</p>
      <div className="resource-facts">
        <div><span>Data controller</span><strong>{controller}</strong></div>
        <div><span>Privacy contact</span><strong>{email}</strong></div>
        <div><span>Controller address</span><strong>{address}</strong></div>
      </div>
      {(!process.env.PRIVACY_CONTACT_EMAIL||!process.env.DATA_CONTROLLER_ADDRESS||!process.env.PRIVACY_LAWFUL_BASIS_REPORTS||!process.env.PRIVACY_LAWFUL_BASIS_ACCOUNTS)&&<div className="notice">CARE-Map is still in pre-production compliance review. The final controller contact/address must be configured and legally reviewed before public launch.</div>}
    </section>

    <section className="grid two">
      <div className="card stack"><h2>What we collect</h2>
        <p><strong>Community reports:</strong> report description, geographic coordinates, capture metadata, and any optional name/contact information you choose to provide.</p>
        <p><strong>Configured lawful basis for core report processing:</strong> {reportsBasis}.</p>
        <p><strong>Community accounts:</strong> name, email, password hash, account status, and reports linked to the account.</p>
        <p><strong>Configured lawful basis for account processing:</strong> {accountsBasis}.</p>
        <p><strong>Field evidence:</strong> photos, captions, inspection records, GPS accuracy, and other operational evidence where staff workflows require them.</p>
        <p>CARE-Map does not ask anonymous reporters to provide a name or contact detail.</p>
      </div>
      <div className="card stack"><h2>Why we process it</h2>
        <p>Core report and location data is processed to receive, investigate, map, verify, prioritize, resolve, and audit ACReSAL-related operational issues.</p>
        <p>Optional reporter identity/contact details are used only for follow-up and are collected separately from the core report. Where you voluntarily provide them, the form asks for explicit consent.</p>
        <p>Registered account data is processed to authenticate you and let you track reports linked to your account.</p>
      </div>
    </section>

    <section className="card stack"><h2>Retention and anonymization</h2>
      <p>CARE-Map’s current operating rule is to anonymize personal identifiers attached to resolved reports after two years, while retaining de-identified operational information where needed for historical, audit, monitoring, or trend purposes.</p>
      <p>Community accounts remain active until disabled or erased. Self-service erasure anonymizes the account identity and removes optional reporter identity/contact fields from linked reports, while operational report records may remain in de-identified form where there is a lawful project need.</p>
      <p>This retention schedule is subject to formal legal review and any applicable ACReSAL or records-management obligations before public launch.</p>
    </section>

    <section className="grid two">
      <div className="card stack"><h2>Your rights</h2>
        <p>You may request access, rectification, erasure, restriction, objection, portability, withdrawal of consent where consent is relied on, or submit a privacy complaint.</p>
        <p>Registered community users can download a self-service export and request account anonymization from the My Reports area. More complex requests can be submitted below.</p>
      </div>
      <div className="card stack"><h2>Sharing, security and complaints</h2>
        <p>Access to non-public personal data is restricted to authorized CARE-Map staff/admin workflows. Database, session, and audit controls are used to reduce unauthorized access.</p>
        <p>Third-party infrastructure may process data on behalf of CARE-Map where necessary to operate the service, such as hosting, database, and evidence-photo storage providers. Final processor/cross-border records require legal review before public launch.</p>
        <p>You may also lodge a complaint with the Nigeria Data Protection Commission.</p>
      </div>
    </section>

    <section className="card stack"><h2>Automated analysis</h2>
      <p>CARE-Map uses rule-based scores, spatial analysis, and remote-sensing signals to help staff prioritize field review. These outputs are decision-support signals, not automatic legal or socio-economic decisions about individuals. Staff verification remains part of operational workflows.</p>
    </section>

    <PrivacyRequestForm/>
  </div>;
}
