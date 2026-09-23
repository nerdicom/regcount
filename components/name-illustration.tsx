export function NameIllustration() {
  return <div className="name-illustration" aria-hidden="true">
    <div className="illustration-caption"><span className="tiny-bars"><i/><i/><i/></span>ONE NAME. MANY POSSIBILITIES.</div>
    <div className="name-map">
      <div className="map-keyword"><span>EXACT NAME</span><strong>yourname<b>.</b></strong></div>
      <svg className="map-connectors" viewBox="0 0 100 180" preserveAspectRatio="none"><path d="M0 90 H30 Q50 90 50 70 V32 Q50 12 70 12 H100"/><path d="M0 90 H100"/><path d="M0 90 H30 Q50 90 50 110 V148 Q50 168 70 168 H100"/></svg>
      <div className="map-suffixes"><span><i/>.com</span><span><i/>.net</span><span><i/>.org</span></div>
    </div>
    <div className="illustration-note">Explore the extensions behind the name.</div>
  </div>;
}
