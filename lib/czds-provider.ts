import { ProviderError } from './provider-error';
import { matchesPosition, type ZoneCoverage, type SearchResult, type SearchPosition, type BulkRow } from './domains';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const tld = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
function invalid(): never { throw new ProviderError('The domain index returned an unexpected response.'); }
export function validateCoverage(value: unknown): ZoneCoverage {
  if (!isObject(value) || value.basis !== 'delegated-domains' || !Array.isArray(value.zones) || !value.zones.length || value.zones.length > 2000 || !Array.isArray(value.requiredMissing) || !value.requiredMissing.every(tld)) return invalid();
  const zones = value.zones.map(zone => {
    if (!isObject(zone) || !tld(zone.tld) || !integer(zone.domainCount) || zone.domainCount < 1 || !validDate(zone.downloadedAt) || !validDate(zone.importedAt)) return invalid();
    return {tld:zone.tld, domainCount:zone.domainCount, downloadedAt:zone.downloadedAt, importedAt:zone.importedAt, stale:Date.now()-Date.parse(zone.downloadedAt)>72*3600000};
  });
  if (new Set(zones.map(zone=>zone.tld)).size !== zones.length || value.requiredMissing.some(t=>zones.some(zone=>zone.tld===t))) return invalid();
  return {basis:'delegated-domains', zones, requiredMissing:value.requiredMissing};
}
function suffixes(value: unknown, coverage: ZoneCoverage): string[] {
  if (!Array.isArray(value) || !value.every(tld) || new Set(value).size !== value.length || value.some(t=>!coverage.zones.some(zone=>zone.tld===t))) return invalid();
  return value;
}
async function request(path: string, body?: object): Promise<unknown> {
  const token = process.env.REGCOUNT_CZDS_API_TOKEN;
  let origin: URL;
  try { origin = new URL(process.env.REGCOUNT_CZDS_API_URL || ''); } catch { throw new ProviderError('The domain index connection is not configured.',503); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || !['','/'].includes(origin.pathname) || !token || !/^[a-f0-9]{64}$/.test(token)) throw new ProviderError('The domain index connection is not configured correctly.',503);
  let response: Response;
  try { response = await fetch(new URL(path,origin), {method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)}); }
  catch { throw new ProviderError('The domain index did not respond. Please try again.',503); }
  if (response.status === 429) throw new ProviderError('Search is busy. Please try again shortly.',429);
  if (!response.ok) throw new ProviderError('The domain index is temporarily unavailable. Please try again.',503);
  try { const text=await response.text(); if(text.length>1000000)return invalid(); return JSON.parse(text); } catch { return invalid(); }
}
export async function searchCZDS(query: string, position: SearchPosition, exactOnly = false): Promise<SearchResult> {
  const params=new URLSearchParams({q:query,position,...(exactOnly?{exact:'1'}:{})});
  const raw=await request(`/v1/search?${params}`);
  if (!isObject(raw) || raw.source!=='czds' || raw.query!==query || raw.position!==position || !integer(raw.total) || !Array.isArray(raw.related) || raw.related.length>100 || typeof raw.relatedPartial!=='boolean' || !validDate(raw.fetchedAt)) return invalid();
  const coverage=validateCoverage(raw.coverage), list=suffixes(raw.suffixes,coverage);
  if (list.length!==raw.total) return invalid();
  const related=raw.related.map(row=>{
    if(!isObject(row)||!tld(row.name)||row.name===query||!matchesPosition(row.name,query,position)||!integer(row.count))return invalid();
    const list=suffixes(row.suffixes,coverage);if(list.length!==row.count)return invalid();
    return {name:row.name,count:row.count,suffixes:list};
  });
  if(new Set(related.map(row=>row.name)).size!==related.length)return invalid();
  return {query,position,source:'czds',total:raw.total,suffixes:list,related,relatedPartial:raw.relatedPartial,
    ...(typeof raw.relatedMessage==='string'?{relatedMessage:raw.relatedMessage.slice(0,400)}:{}),fetchedAt:raw.fetchedAt,coverage};
}
export async function bulkCZDS(queries: string[]): Promise<{source:'czds';results:BulkRow[];coverage:ZoneCoverage}> {
  const raw=await request('/v1/bulk',{queries});
  if(!isObject(raw)||raw.source!=='czds'||!Array.isArray(raw.results)||raw.results.length!==queries.length)return invalid();
  const coverage=validateCoverage(raw.coverage);
  const results=raw.results.map(row=>{
    if(!isObject(row)||typeof row.query!=='string'||!queries.includes(row.query)||row.source!=='czds'||!integer(row.total))return invalid();
    const list=suffixes(row.suffixes,coverage);if(list.length!==row.total)return invalid();
    return {query:row.query,total:row.total,source:'czds' as const,suffixes:list,coverage};
  });
  if(new Set(results.map(row=>row.query)).size!==queries.length)return invalid();
  return {source:'czds',results,coverage};
}
