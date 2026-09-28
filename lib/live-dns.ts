import { randomUUID } from 'node:crypto';
import { normalizeQuery } from './domains';
import { ProviderError } from './provider-error';
import { LIVE_EXACT_SUFFIXES, type LiveExtensionObservation, type LiveExtensionResult } from './live-extensions';

type DNSResult = { status: LiveExtensionObservation['status']; ttl: number; checkedAt: string };
const unknown = (): DNSResult => ({ status: 'unavailable', ttl: 0, checkedAt: new Date().toISOString() });
const cache = new Map<string, { expires: number; value: DNSResult }>();
const wildcardCache = new Map<string, { expires: number; value: DNSResult }>();
const wildcardPending = new Map<string, Promise<DNSResult>>();
const searches = new Map<string, Promise<LiveExtensionResult>>();
let windowStart = 0, windowCount = 0;

function hostname(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase().replace(/\.$/, '') : '';
}

// Only an exact-owner NS answer establishes evidence. A/AAAA, CNAME, parent
// authority records, NXDOMAIN, SERVFAIL and malformed answers cannot add a count.
export function parseDNSReply(value: unknown, name: string): DNSResult {
  if (!value || typeof value !== 'object') return unknown();
  const body = value as { Status?: unknown; TC?: unknown; Question?: { name?: unknown; type?: unknown }[]; Answer?: { name?: unknown; type?: unknown; data?: unknown; TTL?: unknown }[] };
  if (body.TC !== false || !Array.isArray(body.Question) || body.Question.length !== 1
    || hostname(body.Question[0]?.name) !== name || body.Question[0]?.type !== 2) return unknown();
  if (body.Status === 3) return { status: 'not-confirmed', ttl: 30, checkedAt: new Date().toISOString() };
  if (body.Status !== 0 || (body.Answer !== undefined && !Array.isArray(body.Answer))) return unknown();
  const records = (body.Answer ?? []).filter(row => row && row.type === 2 && hostname(row.name) === name
    && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname(row.data))
    && typeof row.TTL === 'number' && Number.isFinite(row.TTL) && row.TTL >= 0);
  return { status: records.length ? 'confirmed' : 'not-confirmed',
    ttl: records.length ? Math.min(300, ...records.map(row => Number(row.TTL))) : 30,
    checkedAt: new Date().toISOString() };
}

async function lookup(name: string, batchSignal: AbortSignal): Promise<DNSResult> {
  try {
    const url = new URL('https://dns.google/resolve');
    url.searchParams.set('name', name); url.searchParams.set('type', 'NS');
    url.searchParams.set('edns_client_subnet', '0.0.0.0/0');
    const response = await fetch(url, { cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([batchSignal, AbortSignal.timeout(8000)]) });
    if (!response.ok) return unknown();
    // Bound the response while reading, not just after allocating it.
    const reader = response.body?.getReader();
    if (!reader) return unknown();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 65536) { await reader.cancel(); return unknown(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return parseDNSReply(JSON.parse(Buffer.concat(chunks).toString('utf8')), name);
  } catch { return unknown(); }
}

async function checkWildcard(suffix: string, signal: AbortSignal) {
  const cached = wildcardCache.get(suffix);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = wildcardPending.get(suffix); if (existing) return existing;
  const pending = lookup(`rc-check-${randomUUID()}.${suffix}`, signal).then(value => {
    if (value.status !== 'unavailable') wildcardCache.set(suffix, { value, expires: Date.now() + Math.min(30, value.ttl) * 1000 });
    return value;
  }).finally(() => wildcardPending.delete(suffix));
  wildcardPending.set(suffix, pending); return pending;
}

async function checkDomain(query: string, suffix: string, signal: AbortSignal): Promise<LiveExtensionObservation> {
  const name = `${query}.${suffix}`, cached = cache.get(name);
  if (cached && cached.expires > Date.now()) return { suffix, status: cached.value.status, checkedAt: cached.value.checkedAt };
  let result = await lookup(name, signal);
  if (result.status === 'confirmed') {
    const wildcard = await checkWildcard(suffix, signal);
    // Fail closed if a random name also has NS records, or the control fails.
    if (wildcard.status !== 'not-confirmed') result = unknown();
    else result.ttl = Math.min(result.ttl, wildcard.ttl);
  }
  if (result.status !== 'unavailable' && result.ttl > 0) {
    if (cache.size >= 2000) cache.delete(cache.keys().next().value!);
    cache.set(name, { value: result, expires: Date.now() + result.ttl * 1000 });
  }
  return { suffix, status: result.status, checkedAt: result.checkedAt };
}

export async function checkLiveExtensions(value: string, excluded: string[] = []): Promise<LiveExtensionResult> {
  const query = normalizeQuery(value);
  const suffixes = LIVE_EXACT_SUFFIXES.filter(suffix => !excluded.includes(suffix));
  const key = `${query}:${suffixes.join(',')}`;
  const existing = searches.get(key); if (existing) return existing;
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); windowCount = 0; }
  if (searches.size >= 2 || windowCount >= 30) throw new ProviderError('Live extension checks are busy. Try again shortly.', 429);
  windowCount++;
  const pending = (async (): Promise<LiveExtensionResult> => {
    const signal = AbortSignal.timeout(20000);
    const observations: LiveExtensionObservation[] = new Array(suffixes.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, suffixes.length) }, async () => {
      while (next < suffixes.length) {
        const index = next++, suffix = suffixes[index];
        observations[index] = signal.aborted ? { suffix, status: 'unavailable', checkedAt: new Date().toISOString() }
          : await checkDomain(query, suffix, signal);
      }
    }));
    return { query, source: 'google-public-dns', basis: 'exact-name-ns', observations };
  })().finally(() => searches.delete(key));
  searches.set(key, pending); return pending;
}
