import type { ZoneCoverage } from '@/lib/domains';
import Link from 'next/link';

export function CoverageNote({coverage,liveExact=false}:{coverage:ZoneCoverage;liveExact?:boolean}) {
  const stale=coverage.zones.filter(zone=>zone.stale);
  return <>
    {coverage.requiredMissing.length>0&&<p className="coverage-visible-gap"><strong>{liveExact?'Not in the keyword index:':'Not included in these counts:'}</strong> {coverage.requiredMissing.map(tld=>`.${tld}`).join(', ')}. {liveExact&&'Confirmed live DNS matches above count toward this exact name only. '}<Link href="/coverage">View coverage</Link></p>}
    <details className="coverage-note">
    <summary>{coverage.zones.length} extensions indexed · CZDS zone snapshots{stale.length ? ` · ${stale.length} need refreshing` : ''}</summary>
    <p>Counts include names delegated in these DNS zones. They do not cover every registered domain, and a missing name does not mean it is available.</p>
    {coverage.requiredMissing.length>0&&<p><strong>Priority extensions not yet indexed:</strong> {coverage.requiredMissing.map(tld=>`.${tld}`).join(', ')}. {liveExact?'See the live checks for evidence about this exact name.':'Their registration status is unknown.'}</p>}
    <ul>{coverage.zones.map(zone=><li key={zone.tld}><strong>.{zone.tld}</strong><span>Downloaded {new Date(zone.downloadedAt).toISOString().slice(0,16).replace('T',' ')} UTC{zone.stale?' · Older than 72 hours':''}</span></li>)}</ul>
  </details></>;
}
