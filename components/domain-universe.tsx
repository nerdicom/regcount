import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, Globe2, Layers3, Search } from 'lucide-react';

/** An illustration of a name across extensions, not a coverage or results display. */
export function DomainUniverse({ name }: { name: string }) {
  const label = name.trim().replace(/^https?:\/\//i, '').split(/[.\s/]/)[0].slice(0, 16) || 'yourname';
  return <div className="domain-universe" aria-hidden="true">
    <div className="universe-glow"/>
    <svg className="universe-lines" viewBox="0 0 520 340" fill="none">
      <g className="universe-globe" stroke="currentColor">
        <circle cx="260" cy="168" r="130"/>
        <ellipse cx="260" cy="168" rx="82" ry="130"/>
        <ellipse cx="260" cy="168" rx="30" ry="130"/>
        <ellipse cx="260" cy="168" rx="130" ry="46"/>
        <ellipse cx="260" cy="168" rx="130" ry="94"/>
        <path d="M130 168h260M260 38v260"/>
      </g>
      <ellipse className="universe-orbit" cx="260" cy="168" rx="216" ry="89" transform="rotate(-23 260 168)"/>
      <ellipse className="universe-orbit universe-orbit-secondary" cx="260" cy="168" rx="197" ry="108" transform="rotate(30 260 168)"/>
      <g className="universe-stars" fill="currentColor">
        <circle cx="72" cy="76" r="2"/><circle cx="411" cy="54" r="3"/>
        <circle cx="454" cy="251" r="2"/><circle cx="144" cy="283" r="3"/>
        <path d="M447 103v10m-5-5h10M102 217v10m-5-5h10" stroke="currentColor"/>
      </g>
    </svg>
    <span className="orbit-extension orbit-com">.com<span className="extension-spark"/></span>
    <span className="orbit-extension orbit-ai">.ai</span>
    <span className="orbit-extension orbit-org">.org</span>
    <span className="orbit-extension orbit-io">.io</span>
    <span className="orbit-extension orbit-dev">.dev</span>
    <span className="orbit-extension orbit-net">.net</span>
    <div className="universe-name"><span className="universe-name-icon"><Globe2 size={21}/></span><span>{label}<b>.</b></span></div>
    <span className="universe-caption"><i/>ONE NAME. A WORLD OF POSSIBILITIES.</span>
  </div>;
}

export function SearchDiscovery({ onFocus }: { onFocus: () => void }) {
  return <section className="search-discovery" aria-labelledby="discovery-heading">
    <div className="discovery-heading"><h2 id="discovery-heading">A little curiosity goes a long way.</h2><span>MAKE YOUR NEXT MOVE</span></div>
    <div className="discovery-grid">
      <button className="discovery-card discovery-search" onClick={onFocus}>
        <div className="discovery-card-top"><span className="discovery-icon"><Search size={22}/></span><ArrowUpRight size={20}/></div>
        <h3>Follow the name.</h3><p>Explore exact matches and the extensions behind a name.</p>
        <div className="discovery-detail"><span className="discovery-suffix">.org</span><span className="discovery-suffix">.app</span><span className="discovery-suffix">.dev</span><span className="discovery-detail-label">Start exploring <ArrowRight size={14}/></span></div>
      </button>
      <Link className="discovery-card discovery-compare" href="/bulk-domain-search">
        <div className="discovery-card-top"><span className="discovery-icon"><Layers3 size={22}/></span><ArrowUpRight size={20}/></div>
        <h3>Meet your shortlist.</h3><p>Put your best ideas side by side. See which names go further.</p>
        <div className="discovery-detail"><span className="shortlist-symbol" aria-hidden="true"><i/><i/><i/></span><span className="discovery-detail-label">Up to 50 names <ArrowRight size={14}/></span></div>
      </Link>
      <Link className="discovery-card discovery-coverage" href="/coverage">
        <div className="discovery-card-top"><span className="discovery-icon"><ChartNoAxesColumnIncreasing size={22}/></span><ArrowUpRight size={20}/></div>
        <h3>Look under the hood.</h3><p>Good research starts with knowing what your data covers.</p>
        <div className="discovery-detail"><span className="coverage-symbol" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></span><span className="discovery-detail-label">Explore coverage <ArrowRight size={14}/></span></div>
      </Link>
    </div>
  </section>;
}
