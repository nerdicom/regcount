import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticatedRequest, verifyAdvanced } from './verify-advanced.mjs';

test('verification keeps authentication on loopback and hides remote error bodies', async () => {
  const token = 'a'.repeat(64);
  const request = authenticatedRequest(token, async (url, options) => {
    assert.equal(new URL(url).origin, 'http://127.0.0.1:8787');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    assert.equal(options.redirect, 'error');
    return Response.json({ error: 'private server details ' + token }, { status: 409 });
  });
  await assert.rejects(request('/v2/search?q=cypress'), error => /index changed/.test(error.message) && !error.message.includes(token));
  await assert.rejects(request('https://untrusted.test'), /Unsupported/);
  for (const status of [401, 404, 429, 500, 503]) {
    const failed = authenticatedRequest(token, async () => Response.json({ error: token }, { status }));
    await assert.rejects(failed('/v2/search?q=agent'), error => !error.message.includes(token));
  }
  const failed = authenticatedRequest(token, async () => { throw Error(token); });
  await assert.rejects(failed('/v2/search?q=agent'), error => !error.message.includes(token));
});

test('query budget exhaustion never reports a passing deployment check', async () => {
  const snapshot = 'b'.repeat(64), logs = [];
  const request = async path => {
    if (path === '/v2/search?q=zz') return { research: { version: 2, snapshot }, coverage: { zones: [{ tld: 'dev' }] } };
    return { research: { version: 2, snapshot, page: 1, timedOut: true, keywordCount: null }, related: [] };
  };
  const result = await verifyAdvanced({ request, log: message => logs.push(message) });
  assert.equal(result.limited, 4);
  assert(!logs.some(line => line.startsWith('PASS:')));
  assert(logs.at(-1).includes('Review the limited queries'));
});

test('verification rejects an empty index before running broad queries', async () => {
  await assert.rejects(verifyAdvanced({ request: async () => ({ research: { version: 2, snapshot: 'b'.repeat(64) }, coverage: { zones: [] } }) }), /No imported extensions/);
});
