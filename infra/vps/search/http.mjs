import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { search, bulk, status, SearchError } from './database.mjs';

export function createSearchServer({ pool, token, now = Date.now }) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('A 256-bit API token is required.');
  const expected = Buffer.from('Bearer ' + token);
  let active = 0, credits = 30, lastCredit = now();
  const cache = new Map();
  function reply(res, code, payload) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff', ...(code === 429 ? { 'Retry-After': '30' } : {}) });
    res.end(JSON.stringify(payload));
  }
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    if (req.url === '/healthz' && req.method === 'GET') return reply(res, 200, { status: 'up' });
    const auth = Buffer.from(req.headers.authorization || '');
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return reply(res, 401, { error: 'Unauthorized.' });
    if ((req.url || '').length > 2048) return reply(res, 414, { error: 'Request too long.' });
    credits = Math.min(30, credits + Math.max(0, now() - lastCredit) / 500); lastCredit = now();
    if (credits < 1) return reply(res, 429, { error: 'Search limit reached. Please try again shortly.' });
    credits--;
    if (active >= 4) return reply(res, 503, { error: 'Search is busy. Please try again shortly.' });
    active++;
    try {
      const url = new URL(req.url, 'http://internal');
      let value;
      if (url.pathname === '/v1/status' && req.method === 'GET') value = await status(pool);
      else if (url.pathname === '/v1/search' && req.method === 'GET') {
        if ([...url.searchParams.keys()].some(key => !['q', 'position', 'exact'].includes(key)) ||
          [...new Set(url.searchParams.keys())].some(key => url.searchParams.getAll(key).length > 1)) throw new SearchError('Invalid parameters.', 400);
        const query = url.searchParams.get('q'), position = url.searchParams.get('position') ?? 'any';
        const exactValue = url.searchParams.get('exact');
        if (exactValue !== null && exactValue !== '1') throw new SearchError('Invalid exact parameter.', 400);
        const key = JSON.stringify([query, position, exactValue]);
        const cached = cache.get(key);
        if (cached?.expires > now()) value = cached.value;
        else {
          value = await search(pool, query, position, exactValue === '1');
          if (cache.size >= 500) cache.delete(cache.keys().next().value);
          cache.set(key, { value, expires: now() + 60000 });
        }
      } else if (url.pathname === '/v1/bulk' && req.method === 'POST') {
        let text = '';
        for await (const chunk of req) {
          text += chunk.toString();
          if (text.length > 20000) throw new SearchError('Request body too large.', 413);
        }
        let data;
        try { data = JSON.parse(text); } catch { throw new SearchError('Invalid JSON.', 400); }
        value = await bulk(pool, data?.queries);
      } else return reply(res, 404, { error: 'Not found.' });
      reply(res, 200, value);
    } catch (error) {
      // Do not expose SQL, credentials, response bodies or raw exception text.
      reply(res, error instanceof SearchError ? error.status : 503,
        { error: error instanceof SearchError ? error.message : 'The domain index is temporarily unavailable. Please try again.' });
    } finally { active--; }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.timeout = 15000;
  server.keepAliveTimeout = 5000; server.maxRequestsPerSocket = 100;
  return server;
}
