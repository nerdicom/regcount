import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Run sequentially through the authenticated API, with its normal query limits.
// Output only fixed labels, timings and aggregate counts, never response bodies.
export async function verifyAdvanced({ request, log = console.log }) {
  const probe = await request('/v2/search?q=zz');
  const snapshot = probe.research?.snapshot;
  const zones = probe.coverage?.zones;
  if (probe.research?.version !== 2 || !/^[a-f0-9]{64}$/.test(snapshot ?? '') || !Array.isArray(zones)) {
    throw Error('Unexpected advanced-search response.');
  }
  if (!zones.length) throw Error('No imported extensions are available to verify.');
  const tld = zones[0].tld;
  if (typeof tld !== 'string' || !/^[a-z0-9-]{1,63}$/.test(tld)) throw Error('Unexpected coverage response.');
  const cases = [
    ['Common keyword', { q: 'agent', sort: 'count_desc' }],
    ['Name ranking', { q: 'cypress', sort: 'count_desc' }],
    ['Multiple keywords', { q: 'new york', sort: 'name' }],
    ['Combined filters', { q: 'cypress', position: 'beginning', sort: 'count_asc', tlds: tld, min: '7', max: '20', exclude: 'shop', omit: 'digits,hyphens,idns' }],
  ];
  let limited = 0, pageCandidate;
  async function check(label, options) {
    const params = new URLSearchParams({ ...options, snapshot });
    const start = performance.now();
    const result = await request('/v2/search?' + params);
    const elapsed = Math.round(performance.now() - start);
    const meta = result.research;
    if (meta?.version !== 2 || meta.snapshot !== snapshot || meta.page !== Number(options.page ?? 1) || !Array.isArray(result.related)) {
      throw Error('Unexpected advanced-search response.');
    }
    if (meta.timedOut) {
      if (meta.keywordCount !== null || result.related.length) throw Error('Unexpected timeout response.');
      limited++;
      log(`LIMIT: ${label}; ${elapsed} ms; query exceeded its resource budget.`);
    } else {
      if (!Number.isSafeInteger(meta.keywordCount) || meta.keywordCount < 0 || typeof meta.hasNext !== 'boolean') {
        throw Error('Unexpected advanced-search totals.');
      }
      log(`PASS: ${label}; ${elapsed} ms; ${meta.keywordCount} matching names; ${result.related.length} rows on this page.`);
      if (!pageCandidate && meta.hasNext) pageCandidate = { options, names: new Set(result.related.map(row => row.name)) };
    }
    return result;
  }
  for (const [label, options] of cases) await check(label, options);
  if (pageCandidate) {
    const second = await check('Second page', { ...pageCandidate.options, page: '2' });
    if (second.related.some(row => pageCandidate.names.has(row.name))) throw Error('Pagination repeated a related name.');
  } else log('SKIP: Second page; no completed query returned another page.');
  log(limited ? 'RESULT: Review the limited queries before activating advanced search.' : 'RESULT: Selected queries passed. These timings are not a load or capacity test.');
  return { limited };
}

export function authenticatedRequest(token, fetcher = fetch) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Missing or invalid API token.');
  return async path => {
    if (!path.startsWith('/v2/search?')) throw Error('Unsupported verification request.');
    let response;
    try {
      response = await fetcher('http://127.0.0.1:8787' + path, {
        headers: { Authorization: 'Bearer ' + token }, redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
    } catch { throw Error('The private advanced-search request failed or timed out.'); }
    if (!response.ok) {
      const messages = { 401: 'The API rejected its authentication token.', 404: 'Advanced search is not installed.',
        409: 'The index changed during verification. Run the command again.',
        429: 'Search is busy. Retry verification after traffic subsides.',
        503: 'The search service is busy or unavailable. Retry verification.' };
      throw Error(messages[response.status] || 'The advanced-search request was rejected.');
    }
    try { return await response.json(); } catch { throw Error('The API returned invalid JSON.'); }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const request = authenticatedRequest(readFileSync('/run/secrets/search_api_token', 'utf8').trim());
    const { limited } = await verifyAdvanced({ request });
    process.exitCode = limited ? 2 : 0;
  } catch (error) {
    // Only errors created above contain operational text; filesystem errors do not.
    console.error('ERROR: ' + (error?.code ? 'Unable to read the private API token.' : error.message));
    process.exitCode = 1;
  }
}
