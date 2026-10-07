import RemoteSensingWorkbench from "@/components/RemoteSensingWorkbench";

export default function RemoteSensingPage(){
  return <div className="stack">
    <div className="section-head"><div><h1>Remote Sensing</h1><div className="muted">Sentinel-2 NDVI vegetation monitoring, clear-pixel area estimates and change analysis.</div></div></div>
    <RemoteSensingWorkbench/>
  </div>;
}
