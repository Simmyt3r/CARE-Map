import MapComposer from "@/components/MapComposer";

export default function MapComposerPage(){
  return <div className="stack">
    <div className="section-head print-hide">
      <div><h1>Map Composer</h1><div className="muted">Build clean operational maps from CARE-Map layers, then print or save them as PDF.</div></div>
    </div>
    <MapComposer/>
  </div>;
}
