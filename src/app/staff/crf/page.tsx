import {getSession,isAdmin} from "@/lib/auth";
import {crfAccess} from "@/lib/crf";
import CrfOperationsCenter from "@/components/CrfOperationsCenter";
export const dynamic="force-dynamic";
export const metadata={title:"Benue CRF Monitoring | CARE-Map"};
export default async function BenueCrfPage(){
 const session=await getSession();
 let initialAccess=false;
 try{initialAccess=Boolean(await crfAccess(session));}catch{
  // Migration 019 may still be pending; display activation guidance instead.
 }
 return <div className="stack">
  <CrfOperationsCenter admin={isAdmin(session)} initialAccess={initialAccess}/>
  {!initialAccess&&<div className="card stack">
    <h2>Activation and safeguards</h2>
    <p>The new CRF monitoring schema is introduced by database migration 019.
      An administrator must confirm the database backup, apply the migration through
      the existing Database migrations page, and grant CRF-specific duty assignments.
      This module does not create beneficiary or financial data automatically.</p>
    <a className="btn" href="/staff/admin/migrations">Database migration manager</a>
  </div>}
 </div>;
}
