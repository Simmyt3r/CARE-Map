import OperationsCenter from "@/components/OperationsCenter";

export default function OperationsPage(){
  return <div className="stack">
    <div className="section-head"><div><h1>Operations Center</h1><div className="muted">A single view of urgent, overdue, unassigned and recent operational work.</div></div></div>
    <OperationsCenter/>
  </div>;
}
