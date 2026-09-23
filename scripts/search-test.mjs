// Exercise the actual adapter with deterministic provider responses, without network calls.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temporary = await mkdtemp(join(tmpdir(), 'regcount-search-'));
const nativeFetch = globalThis.fetch;
const originalSettings = { REGCOUNT_LIVE_ENABLED: process.env.REGCOUNT_LIVE_ENABLED, REGCOUNT_DATA_SOURCE: process.env.REGCOUNT_DATA_SOURCE, DOTDB_API_KEY: process.env.DOTDB_API_KEY };
const calls = [];
const row = (name, suffixes = ['com', 'net']) => ({ name, count: suffixes.length, suffixes });
try {
  for (const name of ['domains', 'provider-error', 'czds-provider', 'registration-provider']) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    await writeFile(join(temporary, `${name}.mjs`), compiled.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"));
  }
  const { searchRegistrations } = await import(pathToFileURL(join(temporary, 'registration-provider.mjs')).href);
  process.env.REGCOUNT_LIVE_ENABLED = 'true';
  process.env.REGCOUNT_DATA_SOURCE = 'dotdb';
  process.env.DOTDB_API_KEY = 'local-test-key';
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.dotdb.com');
    assert.equal(options.headers.Authorization, 'Token local-test-key');
    const keyword = url.searchParams.get('keyword');
    const position = url.searchParams.get('position');
    calls.push(url);
    if (keyword === 'fallback') {
      if (url.searchParams.has('min_length')) {
        assert.equal(position, 'end', 'Exact fallback must preserve the match mode');
        assert.equal(url.searchParams.get('min_length'), '8');
        assert.equal(url.searchParams.get('max_length'), '8');
        return Response.json({ exact_match_total_suffix: 2, total_name: 1, matches: [row('fallback')] });
      }
      return Response.json({ exact_match_total_suffix: 2, total_name: 10, matches: [row('getfallback')] });
    }
    if (keyword === 'missing') return Response.json({ exact_match_total_suffix: 0, total_name: 0, matches: [] });
    if (keyword === 'broken') return new Response('Unavailable', { status: 503 });
    // Include an off-position row to verify the adapter enforces the requested mode too.
    return Response.json({ exact_match_total_suffix: 2, total_name: 4, matches: [row('atlas'), row('atlaslabs'), row('getatlas'), row('myatlaslabs')] });
  };
  const any = await searchRegistrations('ATLAS.com');
  const beginning = await searchRegistrations('atlas', 'beginning');
  const ending = await searchRegistrations('atlas', 'end');
  assert.deepEqual(calls.map(url => url.searchParams.get('position')), ['any', 'beginning', 'end']);
  assert.deepEqual(any.related.map(row => row.name), ['atlaslabs', 'getatlas', 'myatlaslabs']);
  assert.deepEqual(beginning.related.map(row => row.name), ['atlaslabs']);
  assert.deepEqual(ending.related.map(row => row.name), ['getatlas']);
  for (const result of [any, beginning, ending]) {
    assert.equal(result.total, 2);
    assert.deepEqual(result.suffixes, ['com', 'net']);
    assert.equal(result.source, 'dotdb');
  }
  assert.equal(beginning.relatedPartial, true);
  assert.equal((await searchRegistrations('atlas', 'beginning')).position, 'beginning');
  assert.equal((await searchRegistrations('atlas', 'end')).position, 'end');
  assert.equal((await searchRegistrations('atlas')).position, 'any');
  assert.equal(calls.length, 3, 'Cache entries must be isolated by keyword position');
  const fallback = await searchRegistrations('fallback', 'end');
  assert.equal(calls.length, 5);
  assert.deepEqual(fallback.suffixes, ['com', 'net']);
  assert.equal(fallback.relatedPartial, true);
  assert.equal((await searchRegistrations('missing', 'end')).total, 0, 'Provider zero is a known count');
  await assert.rejects(searchRegistrations('atlas', 'shuffle'), /Choose Any position/);
  await assert.rejects(searchRegistrations('broken', 'end'), /temporarily unavailable/);
  process.env.REGCOUNT_LIVE_ENABLED = 'false';
  const middle = await searchRegistrations('yp', 'any');
  assert.equal(middle.total, null);
  assert.equal(middle.related.length, 5, 'Any position must find interior substrings');
  assert.equal((await searchRegistrations('yp', 'beginning')).related.length, 0);
  assert.equal((await searchRegistrations('yp', 'end')).related.length, 0);
  assert.equal((await searchRegistrations('cypresslabs')).total, 9, 'Related samples must be searchable themselves');
  console.log('Passed: provider position parameters, cache isolation, exact fallback, partial coverage, known zero, unknown samples, and interior keyword matches.');
} finally {
  globalThis.fetch = nativeFetch;
  for (const [name, value] of Object.entries(originalSettings)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  await rm(temporary, { recursive: true, force: true });
}
