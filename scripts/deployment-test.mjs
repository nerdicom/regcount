import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Run only packaged runtime files, with no access to the source checkout's
// node_modules. This catches missing traces, assets, and entry-point errors.
const root = new URL('../', import.meta.url);
const stage = await mkdtemp(join(tmpdir(), 'regcount-deployment-'));
let child;
let logs = '';
try {
  await cp(new URL('.next/standalone/', root), join(stage, '.next/standalone'), { recursive: true });
  await mkdir(join(stage, 'scripts'));
  await cp(new URL('scripts/start.mjs', root), join(stage, 'scripts/start.mjs'));

  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', REGCOUNT_LIVE_ENABLED: 'false' };
  for (const key of ['NODE_PATH', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_CLIENT_SECRET', 'REGCOUNT_CZDS_API_TOKEN', 'REGCOUNT_CZDS_API_URL', 'DOTDB_API_KEY']) delete env[key];
  child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: stage, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  child.on('error', error => { logs += error.message; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Packaged server exited: ${logs}`);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(100);
  }
  assert.ok(ready, `Packaged server did not start: ${logs}`);
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), { status: 'ok', service: 'regcount', release: 'standalone-20260928' });
  const home = await fetch(base);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /RegCount/);
  for (const route of ['/coverage', '/regcount-logo.png', '/nerdi-logo.webp', '/social-image']) {
    assert.equal((await fetch(base + route)).status, 200, `${route} must work from the package alone`);
  }
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)];
  assert.ok(assets.length > 0);
  for (const [, asset] of assets) assert.equal((await fetch(new URL(asset.replaceAll('&amp;', '&'), base))).status, 200, asset);
  const search = await fetch(`${base}/api/search?q=cypress`);
  assert.equal(search.status, 200);
  const result = await search.json();
  assert.equal(result.source, 'demo');
  assert.equal(result.total, 48);
  console.log('Passed: isolated deployment starts and serves health, homepage, coverage, logos, social image, JS/CSS, and search.');
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill('SIGTERM');
    await exited;
    clearTimeout(timer);
  }
  await rm(stage, { recursive: true, force: true });
}
