export default function ResourceNotFound(){
  return <div className="card" style={{maxWidth:680,margin:"40px auto"}}>
    <h1>Resource not available</h1>
    <p className="muted">This CARE-Map resource does not exist or is not approved for public viewing.</p>
    <a className="btn primary" href="/">Return to the public map</a>
  </div>;
}
