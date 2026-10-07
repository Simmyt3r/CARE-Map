import MyReports from "@/components/MyReports";
import PrivacyAccountControls from "@/components/PrivacyAccountControls";

export default function MyReportsPage(){
  return <div className="stack">
    <div><h1>My reports</h1><div className="muted">Registered community users can track reports linked to their account.</div></div>
    <MyReports/>
    <PrivacyAccountControls/>
  </div>;
}
