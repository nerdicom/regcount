'use client';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import type { LiveExtensionResult } from '@/lib/live-extensions';
export function LiveExtensionNote({ data, loading, error, added, retry }: {
  data: LiveExtensionResult | null; loading: boolean; error: string; added: number; retry: () => void;
}) {
  const unavailable = data?.observations.filter(row => row.status === 'unavailable').length ?? 0;
  return <section className="live-extension-note" aria-label="Live exact-name checks" aria-busy={loading}>
    <div className="live-extension-heading"><strong>{loading ? <><LoaderCircle size={16} className="spinning"/>Checking more extensions…</> : 'Live exact-name checks'}</strong>
      {!loading && <button onClick={retry}><RefreshCw size={14}/>Check again</button>}</div>
    <p role="status">{loading ? 'Checking .com, .ai, .si, .io and other popular extensions. Matches will be added to your exact-name count.'
      : error || `${added} additional ${added === 1 ? 'extension' : 'extensions'} confirmed by DNS. ${unavailable ? `${unavailable} ${unavailable === 1 ? 'check' : 'checks'} could not finish.` : 'Checks complete.'}`}</p>
    {data && <details><summary>View all {data.observations.length} extension checks</summary><div className="live-check-list">{data.observations.map(row => <span key={row.suffix} className={`live-check-${row.status}`} title={`Checked ${new Date(row.checkedAt).toISOString()}`}>
      <b>.{row.suffix}</b><small>{row.status === 'confirmed' ? 'DNS confirmed' : row.status === 'unavailable' ? 'Check unavailable' : 'Not confirmed'}</small>
    </span>)}</div></details>}
    <small>Live DNS confirms nameserver records for this exact name. It does not establish website activity or availability. Related-name searches and bulk counts use the imported index.</small>
  </section>;
}
