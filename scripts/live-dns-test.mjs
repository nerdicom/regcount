import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const temporary = await mkdtemp(join(tmpdir(), 'regcount-dns-'));
const nativeFetch = globalThis.fetch;
try {
  for (const name of ['domains', 'provider-error', 'live-extensions', 'live-dns']) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    await writeFile(join(temporary, `${name}.mjs`), compiled.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"));
  }
  const { parseDNSReply, checkLiveExtensions } = await import(pathToFileURL(join(temporary, 'live-dns.mjs')));
  const { LIVE_EXACT_SUFFIXES, additionalLiveSuffixes, validLiveResult } = await import(pathToFileURL(join(temporary, 'live-extensions.mjs')));
  const name = 'cypress.si';
  const reply = (name, Status = 0, Answer = [{ name: name + '.', type: 2, TTL: 300, data: 'ns.example.net.' }]) => ({ Status, TC: false, Question: [{ name: name + '.', type: 2 }], Answer });
  assert.equal(parseDNSReply(reply(name), name).status, 'confirmed');
  assert.equal(parseDNSReply(reply(name, 3), name).status, 'not-confirmed');
  assert.equal(parseDNSReply(reply(name, 2), name).status, 'unavailable');
  assert.equal(parseDNSReply({ ...reply(name), TC: true }, name).status, 'unavailable');
  assert.equal(parseDNSReply(reply('unrelated.si'), name).status, 'unavailable');
  for (const records of [[], [{ name: 'si.', type: 2, TTL: 300, data: 'ns.example.net.' }],
    [{ name: name + '.', type: 5, TTL: 300, data: 'alias.example.net.' }],
    [{ name: name + '.', type: 1, TTL: 300, data: '192.0.2.1' }],
    [{ name: name + '.', type: 2, TTL: -1, data: 'ns.example.net.' }]]) {
    assert.notEqual(parseDNSReply(reply(name, 0, records), name).status, 'confirmed');
  }
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input), domain = url.searchParams.get('name'); calls++;
    assert.equal(url.origin, 'https://dns.google');
    assert.equal(url.searchParams.get('type'), 'NS');
    assert.equal(url.searchParams.get('edns_client_subnet'), '0.0.0.0/0');
    assert.equal(options.redirect, 'error');
    const control = domain.startsWith('rc-check-');
    if (domain.endsWith('.io')) throw new Error('upstream timeout');
    if (domain.endsWith('.ai')) return new Response('rate limited', { status: 429 });
    if (domain.endsWith('.net')) return new Response('x'.repeat(70000));
    if (domain.endsWith('.de')) return Response.json(reply(domain)); // wildcard NS must not count
    if (control) return Response.json(reply(domain, 3, []));
    if (domain.endsWith('.com') || domain.endsWith('.si')) return Response.json(reply(domain));
    return Response.json(reply(domain, 3, []));
  };
  const result = await checkLiveExtensions('CYPRESS.com');
  assert.equal(result.query, 'cypress');
  assert.equal(result.observations.length, LIVE_EXACT_SUFFIXES.length);
  assert.deepEqual(result.observations.filter(row => row.status === 'confirmed').map(row => row.suffix), ['com', 'si']);
  assert.equal(result.observations.find(row => row.suffix === 'de').status, 'unavailable');
  for (const suffix of ['net', 'ai', 'io']) assert.equal(result.observations.find(row => row.suffix === suffix).status, 'unavailable');
  assert.equal(validLiveResult(result, 'cypress'), true);
  assert.equal(validLiveResult(result, 'another-name'), false);
  assert.equal(validLiveResult({ ...result, observations: [...result.observations, result.observations[0]] }, 'cypress'), false);
  assert.deepEqual(additionalLiveSuffixes(['com'], [], result), ['si'], 'Do not double-count existing suffixes');
  assert.deepEqual(additionalLiveSuffixes([], ['si'], result), ['com'], 'Do not change the snapshot of an indexed suffix');
  assert.deepEqual(additionalLiveSuffixes([], [], null), []);
  const beforeCache = calls;
  await checkLiveExtensions('cypress', LIVE_EXACT_SUFFIXES.filter(s => !['com', 'si'].includes(s)));
  assert.equal(calls, beforeCache, 'Repeated confirmed checks should use the TTL cache');
  const excluded = await checkLiveExtensions('cypress', ['com', 'si']);
  assert.equal(excluded.observations.some(row => ['com', 'si'].includes(row.suffix)), false);
  await assert.rejects(checkLiveExtensions('bad name'), /letters/);
  console.log('Passed: exact-owner evidence, DNS errors, malformed/oversized responses, wildcard controls, deduplication, exclusions, validation and TTL caching.');
} finally {
  globalThis.fetch = nativeFetch;
  await rm(temporary, { recursive: true, force: true });
}
