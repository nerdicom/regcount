'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Download,RefreshCw} from 'lucide-react';
import {csvCell,type ZoneCoverage} from '@/lib/domains';
const priorityExtensions=['com','ai','si','io','dev','xyz'];
export function CoverageDashboard() {
  const [data,setData]=useState<{coverage:ZoneCoverage;checkedAt:string}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [filter,setFilter]=useState('');
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError('');
    try{const response=await fetch('/api/coverage',{cache:'no-store',signal});const body=await response.json();if(!response.ok)throw Error(body.error);if(!signal?.aborted)setData(body);}
    catch(err){if(!signal?.aborted){setError(err instanceof Error?err.message:'Coverage could not be loaded.');setData(null);}}
    finally{if(!signal?.aborted)setLoading(false);}
  },[]);
  useEffect(()=>{const controller=new AbortController();Promise.resolve().then(()=>{if(!controller.signal.aborted)return refresh(controller.signal);});return()=>controller.abort();},[refresh]);
  const zones=data?.coverage.zones??[],records=zones.reduce((n,z)=>n+z.domainCount,0),stale=zones.filter(z=>z.stale).length;
  function exportCoverage(){if(!data)return;const rows=[['Extension','DNS-delegated domains','Downloaded UTC','Imported UTC','Snapshot age warning','Checked UTC'],...zones.map(z=>['.'+z.tld,z.domainCount,z.downloadedAt,z.importedAt,z.stale?'Older than 72 hours':'',data.checkedAt])];const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='regcount-coverage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="coverage-dashboard" aria-busy={loading}>
    <div className="coverage-toolbar"><span>{data?'Checked '+new Date(data.checkedAt).toLocaleString():'Checking the connected index…'}</span><button disabled={loading} onClick={()=>refresh()}><RefreshCw size={15}/>Refresh</button><button disabled={!data||loading} onClick={exportCoverage}><Download size={15}/>Export coverage</button></div>
    {error&&<p role="alert" className="error-message">{error}</p>}
    {data&&<>
      <dl className="coverage-stats"><div><dt>Domain records</dt><dd>{records.toLocaleString()}</dd><span>Across imported DNS zones</span></div><div><dt>Extensions reporting</dt><dd>{zones.length}</dd><span>{stale?`${stale} snapshots older than 72 hours`:'All snapshots within 72 hours'}</span></div><div><dt>Priority gaps</dt><dd>{data.coverage.requiredMissing.length}</dd><span>Awaiting a connected source</span></div></dl>
      <section className="priority-coverage" aria-labelledby="priority-coverage-title"><h2 id="priority-coverage-title">Priority extension coverage</h2><div className="priority-coverage-grid">{priorityExtensions.map(tld=>{const zone=zones.find(z=>z.tld===tld);return <div key={tld} className={zone?'priority-reporting':'priority-missing'}><h3>.{tld}</h3><strong>{zone?(zone.stale?'Needs refresh':'Reporting'):'Not indexed'}</strong><p>{zone?`${zone.domainCount.toLocaleString()} domain records`:'Excluded from search counts'}</p></div>;})}</div></section>
      <div className="coverage-gaps"><h2>Priority extensions not connected</h2><p>{data.coverage.requiredMissing.length?data.coverage.requiredMissing.map(t=>'.'+t).join(' · '):'All configured priority extensions are covered.'}</p><small>Missing coverage is unknown, not zero registrations. Search and exports include imported extensions only.</small></div>
      <label className="coverage-filter">Find an extension<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="e.g. org"/></label>
      <div className="coverage-table-wrap"><table className="coverage-table"><caption className="sr-only">Imported extensions and snapshot freshness</caption><thead><tr><th>Extension</th><th>Domain records</th><th>Downloaded (UTC)</th><th>Freshness</th></tr></thead><tbody>{zones.filter(z=>z.tld.includes(filter.toLowerCase().replace(/^\./,''))).sort((a,b)=>b.domainCount-a.domainCount).map(z=><tr key={z.tld}><th scope="row">.{z.tld}</th><td>{z.domainCount.toLocaleString()}</td><td>{new Date(z.downloadedAt).toISOString().replace('T',' ').slice(0,16)}</td><td><span className={z.stale?'coverage-stale':'coverage-fresh'}>{z.stale?'Older than 72h':'Within 72h'}</span></td></tr>)}</tbody></table></div>
      <p className="coverage-footnote">A record is a domain name present in an imported DNS zone. Counts exclude registrations without DNS delegation and do not measure active websites. This page describes current coverage; it is not a historical growth report. <Link href="/how-it-works">How counts work</Link></p>
    </>}
    {loading&&!data&&<p role="status">Loading coverage…</p>}
  </section>;
}
