import type { ZoneCoverage } from '@/lib/domains';

export function CoverageNote({coverage}:{coverage:ZoneCoverage}) {
  const stale=coverage.zones.filter(zone=>zone.stale);
  return <details className="coverage-note">
    <summary>{coverage.zones.length} extensions covered · CZDS zone snapshots{stale.length ? ` · ${stale.length} need refreshing` : ''}</summary>
    <p>Counts include names delegated in these DNS zones. They do not cover every registered domain, and a missing name does not mean it is available.</p>
    {coverage.requiredMissing.length>0&&<p><strong>Priority extensions not yet covered:</strong> {coverage.requiredMissing.map(tld=>`.${tld}`).join(', ')}. Their registration status is unknown.</p>}
    <ul>{coverage.zones.map(zone=><li key={zone.tld}><strong>.{zone.tld}</strong><span>Downloaded {new Date(zone.downloadedAt).toISOString().slice(0,16).replace('T',' ')} UTC{zone.stale?' · Older than 72 hours':''}</span></li>)}</ul>
  </details>;
}
