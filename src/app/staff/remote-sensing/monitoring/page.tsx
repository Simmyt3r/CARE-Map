import VegetationMonitoring from "@/components/VegetationMonitoring";

export default function VegetationMonitoringPage(){
  return <div className="stack">
    <div className="section-head"><div><h1>Vegetation Monitoring</h1><div className="muted">Schedule recurring Sentinel-2 checks and turn meaningful vegetation loss into operational alerts.</div></div></div>
    <VegetationMonitoring/>
  </div>;
}
