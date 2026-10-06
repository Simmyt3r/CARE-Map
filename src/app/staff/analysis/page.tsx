import SpatialAnalysis from "@/components/SpatialAnalysis";

export default function SpatialAnalysisPage(){
  return <div className="stack">
    <div className="section-head"><div><h1>Spatial Analysis</h1><div className="muted">Ask location-based questions against CARE-Map data using PostGIS distance, area and length functions.</div></div></div>
    <SpatialAnalysis/>
  </div>;
}
