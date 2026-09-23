'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Copy, Download, Info, ListFilter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { csvCell, extensionKind, SEARCH_POSITIONS, sourceLabel as dataSourceLabel, type SearchResult } from '@/lib/domains';
import { CoverageNote } from '@/components/coverage-note';

type ResultRow = {
  name: string;
  count: number | null;
  activeCount?: number | null;
  suffixes: string[];
  exact: boolean;
};

// Missing activity is unknown. A delegation or an extension count is not a website check.
function activeCount(value: number | null | undefined, total: number | null) {
  return total !== null && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= total ? value : null;
}

function ActiveCount({ value }: { value: number | null }) {
  return value === null
    ? <span className="activity-unknown"><span aria-hidden="true">—</span><small>Not checked</small></span>
    : <strong className="activity-count">{value.toLocaleString()}</strong>;
}

export function SearchResults({ result, onSelectName }: { result: SearchResult; onSelectName: (name: string) => void }) {
  const [view, setView] = useState('overview');
  const [kind, setKind] = useState('all');
  const [filter, setFilter] = useState('');
  const [descending, setDescending] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const total = result.total;
  const positionLabel = SEARCH_POSITIONS.find(option => option.value === result.position)!.label;
  const active = activeCount(result.activeCount, total);
  const generic = result.suffixes.filter(suffix => extensionKind(suffix) === 'generic').length;
  const country = result.suffixes.length - generic;
  const hasFilter = kind !== 'all' || filter.trim() !== '';
  const matchesFilter = (suffix: string) => (kind === 'all' || extensionKind(suffix) === kind)
    && suffix.includes(filter.trim().toLowerCase().replace(/^\./, ''));
  const exactSuffixes = result.suffixes.filter(matchesFilter);
  const rows: ResultRow[] = [
    { name: result.query, count: total, activeCount: result.activeCount, suffixes: result.suffixes, exact: true },
    ...[...result.related].sort((a, b) => (descending ? b.count - a.count : a.count - b.count) || a.name.localeCompare(b.name))
      .map(row => ({ ...row, exact: false })),
  ];
  const unknownActivity = rows.some(row => activeCount(row.activeCount, row.count) === null);
  const sourceLabel = dataSourceLabel(result.source);

  function exportResults() {
    const exported: (string | number | null)[][] = view === 'overview'
      ? [['Name', 'Match', 'Count', 'Active websites', 'Extensions shown', 'Data source', 'Filtered', 'Keyword position'],
        ...rows.map(row => [row.name, row.exact ? 'Exact' : 'Related', row.count,
          activeCount(row.activeCount, row.count) ?? 'Not checked',
          row.suffixes.filter(matchesFilter).map(suffix => `.${suffix}`).join(' '), sourceLabel, hasFilter ? 'Yes' : 'No', positionLabel])]
      : [['Keyword', 'Domain', 'Extension', 'Type', 'Data source', 'Keyword position'],
        ...exactSuffixes.map(suffix => [result.query, `${result.query}.${suffix}`, `.${suffix}`, extensionKind(suffix), sourceLabel, positionLabel])];
    if(result.coverage){exported[0].push('Covered extensions','Snapshot download times','Missing priority extensions');for(const row of exported.slice(1))row.push(result.coverage.zones.map(z=>'.'+z.tld).join(' '),result.coverage.zones.map(z=>'.'+z.tld+' '+z.downloadedAt).join('; '),result.coverage.requiredMissing.map(t=>'.'+t).join(' '));}
    const blob = new Blob(['\uFEFF' + exported.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `regcount-${result.query}-${result.position}-${view}-${result.source}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyDomains() {
    try {
      await navigator.clipboard.writeText(exactSuffixes.map(suffix => `${result.query}.${suffix}`).join('\n'));
      setCopyError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copy is unavailable in this browser. Use Download CSV to save these results.');
    }
  }

  return <>
    <div className="results-heading">
      <div><span className="eyebrow">THE NAME AT A GLANCE</span><h2>Results for <span>{result.query}<b>.</b></span></h2></div>
      <span className="sample-badge">{result.source === 'demo' ? 'SAMPLE DATA' : result.source === 'czds' ? 'CZDS SNAPSHOTS' : 'DOTDB DATA'}</span>
    </div>
    <dl className="results-metrics" aria-label="Search summary">
      <div className="metric-primary"><dt>Exact-match count</dt><dd>{total === null ? '—' : total.toLocaleString()}</dd><dd className="metric-detail">{total === null ? 'No exact-name sample' : `Extensions for ${result.query}`}</dd></div>
      <div><dt>Active websites</dt><dd>{active === null ? '—' : active.toLocaleString()}</dd><dd className="metric-detail">{active === null ? 'Activity not checked' : 'Verified active exact matches'}</dd></div>
      <div><dt>Related names shown</dt><dd>{result.relatedPartial&&!result.related.length?'—':result.related.length.toLocaleString()}</dd><dd className="metric-detail">{result.relatedPartial ? 'Limited results · see note below' : 'Separate from your exact count'}</dd></div>
    </dl>
    <div className="results-coverage">
      <span>Keyword position: <strong>{positionLabel}</strong></span>
      {total !== null && <><span><strong>{result.suffixes.length.toLocaleString()}</strong> exact extensions returned</span>
      <span><i className="key-dot teal"/>{generic.toLocaleString()} generic</span>
      <span><i className="key-dot violet"/>{country.toLocaleString()} country code</span></>}
      {total !== null && result.suffixes.length < total && <span className="coverage-warning">The source returned a partial extension list.</span>}
    </div>
    {total === null && <p className="results-filter-note">{result.message}</p>}
    {result.relatedMessage&&<p className="results-filter-note" role="status">{result.relatedMessage}</p>}
    {result.coverage&&<CoverageNote coverage={result.coverage}/>}
    <Tabs value={view} onValueChange={setView} className="result-tabs">
      <div className="overview-toolbar">
        <TabsList variant="line" className="result-nav">
          <TabsTrigger value="overview">Name overview</TabsTrigger>
          <TabsTrigger value="extensions">Extension cards</TabsTrigger>
        </TabsList>
        <button className="results-export" onClick={exportResults} disabled={view === 'extensions' && !exactSuffixes.length}><Download size={16}/>Download CSV</button>
      </div>
      <div className="overview-filters">
        <div className="filter-buttons" role="group" aria-label="Extension type">
          {[['all', 'All extensions'], ['generic', 'Generic'], ['country', 'Country code']].map(([value, label]) =>
            <button key={value} onClick={() => setKind(value)} className={kind === value ? 'selected' : ''} aria-pressed={kind === value}>{label}</button>)}
        </div>
        <div className="extension-filter"><ListFilter size={16}/><input aria-label="Filter extensions" placeholder="Find an extension…" value={filter} onChange={event => setFilter(event.target.value)}/></div>
        {hasFilter && <button className="clear-result-filters" onClick={() => { setKind('all'); setFilter(''); }}>Clear filters</button>}
      </div>
      {hasFilter && <p className="results-filter-note" role="status">Filtering the extension lists. Count and Active totals stay unchanged.</p>}
      <TabsContent value="overview">
        <table className="name-results-table" role="table" aria-describedby="activity-explanation">
          <caption className="sr-only">Exact and related names with extension counts, verified website activity where available, and all returned extensions.</caption>
          <thead role="rowgroup"><tr role="row">
            <th scope="col" role="columnheader">Name</th>
            <th scope="col" role="columnheader" aria-sort={descending ? 'descending' : 'ascending'}>
              <button onClick={() => setDescending(!descending)} aria-label={`Sort related names by count ${descending ? 'ascending' : 'descending'}`}>Count {descending ? <ArrowDown size={14}/> : <ArrowUp size={14}/>}</button>
            </th>
            <th scope="col" role="columnheader">Active</th>
            <th scope="col" role="columnheader">Extensions <span className="column-hint">Full returned list</span></th>
          </tr></thead>
          <tbody role="rowgroup">{rows.map(row => {
            const suffixes = row.suffixes.filter(matchesFilter);
            return <tr key={row.name} role="row" className={row.exact ? 'exact-result-row' : undefined}>
              <th scope="row" role="rowheader" className="result-name-cell">
                {row.exact ? <span className="result-keyword">{row.name}</span> : <button className="result-keyword" onClick={() => onSelectName(row.name)}>{row.name}<ArrowUpRight size={14}/></button>}
                <span className={row.exact ? 'exact-match-label' : 'related-match-label'}>{row.exact ? row.count === null ? 'No exact-name sample' : 'Exact match' : 'Related name'}</span>
              </th>
              <td role="cell" className="result-count-cell"><span className="mobile-column-label" aria-hidden="true">Count</span><strong>{row.count === null ? '—' : row.count.toLocaleString()}</strong></td>
              <td role="cell" className="result-active-cell"><span className="mobile-column-label" aria-hidden="true">Active</span><ActiveCount value={activeCount(row.activeCount, row.count)}/></td>
              <td role="cell" className="result-extensions-cell">
                <span className="mobile-column-label" aria-hidden="true">Extensions</span>
                <div className="suffix-wrap">{suffixes.map(suffix => <a key={suffix} href={`https://${row.name}.${suffix}`} target="_blank" rel="noopener noreferrer" className={`suffix-tag ${extensionKind(suffix)}`} aria-label={`Open ${row.name}.${suffix} in a new tab`}>.{suffix}</a>)}</div>
                {!suffixes.length && <p className="row-extension-note">{row.count === null ? 'Not in the sample collection.' : hasFilter ? 'No extensions match this filter.' : row.count > 0 ? 'Extension list not supplied.' : 'No extensions returned.'}</p>}
                {hasFilter && suffixes.length > 0 && <p className="row-extension-note">{suffixes.length} of {row.suffixes.length} returned extensions shown</p>}
                {row.count !== null && row.suffixes.length < row.count && <p className="row-extension-note">{row.suffixes.length} of {row.count.toLocaleString()} extensions supplied by the source.</p>}
              </td>
            </tr>;
          })}</tbody>
        </table>
        <div className="results-bottom"><span>Exact match stays first. Related names sort by count.</span><span>{rows.length} names shown{result.source === 'demo' ? ' · Sample data' : ''}</span></div>
      </TabsContent>
      <TabsContent value="extensions">
        <p className="extension-cards-intro">Exact-match extensions for <strong>{result.query}</strong></p>
        <div className="extensions-grid">{exactSuffixes.map(suffix => <a key={suffix} href={`https://${result.query}.${suffix}`} target="_blank" rel="noopener noreferrer" className={`extension-chip ${extensionKind(suffix)}`} aria-label={`Open ${result.query}.${suffix} in a new tab`}><span>.{suffix}</span><ArrowUpRight size={14}/></a>)}</div>
        {!exactSuffixes.length && <div className="filter-empty">{total === null ? 'No exact-name sample is available. See Name overview for related sample names.' : hasFilter ? 'No extensions match this filter.' : 'No extensions returned for this name.'}</div>}
        <div className="results-bottom"><span>Showing {exactSuffixes.length} of {result.suffixes.length} returned extensions{result.source === 'demo' ? ' · Sample data' : ''}</span><button onClick={copyDomains} disabled={!exactSuffixes.length}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy domains'}</button></div>
        {copyError && <p className="results-filter-note" role="alert">{copyError}</p>}
      </TabsContent>
    </Tabs>
    <div className="activity-explanation" id="activity-explanation"><Info size={17}/><p><strong>About Active:</strong> this counts verified active websites. {unknownActivity ? '“Not checked” means activity data is unavailable, not zero. ' : ''}An extension appearing in a domain index does not establish website activity.</p></div>
  </>;
}
