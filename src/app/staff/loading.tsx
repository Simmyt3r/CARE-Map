export default function StaffLoading(){
  return <div className="stack" role="status" aria-live="polite" aria-label="Loading CARE-Map workspace">
    <div className="section-head"><div className="stack" style={{gap:9}}>
      <div className="skeleton" style={{width:150,height:12}}/>
      <div className="skeleton" style={{width:270,maxWidth:"80vw",height:32}}/>
    </div></div>
    <div className="stats">
      {[0,1,2,3].map(i=><div className="stat stack" key={i} style={{gap:10}}>
        <div className="skeleton" style={{width:70,height:30}}/>
        <div className="skeleton" style={{width:"75%",height:12}}/>
      </div>)}
    </div>
    <div className="card stack">
      <div className="skeleton" style={{height:18,width:200}}/>
      <div className="skeleton" style={{height:140,width:"100%"}}/>
    </div>
    <p className="muted">Loading workspace records…</p>
  </div>;
}
