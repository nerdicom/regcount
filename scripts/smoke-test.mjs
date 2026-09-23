import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.REGCOUNT_TEST_PORT || 3107);
const servers = [];
async function start(port, live) {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, REGCOUNT_LIVE_ENABLED: String(live), DOTDB_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { if ((await fetch(base)).ok) return base; } catch {}
    await delay(100);
  }
  throw new Error(`Server did not start: ${logs}`);
}

try {
  const base = await start(port, false);
  const home = await fetch(base);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /RegCount/);
  assert.equal((await fetch(`${base}/regcount-logo.png`)).status, 200);
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)];
  assert.ok(assets.length > 0, 'Expected production JS/CSS assets');
  for (const [, asset] of assets) assert.equal((await fetch(new URL(asset.replaceAll('&amp;', '&'), base))).status, 200);
  const single = await (await fetch(`${base}/api/search?q=cypress`)).json();
  assert.equal(single.source, 'demo');
  assert.equal(single.total, 48);
  assert.equal((await (await fetch(`${base}/api/search?q=unknownregcountword`)).json()).total, null);
  // Use node:http so the proxy test can set Host explicitly (fetch may replace it).
  const bulk = (origin, host) => new Promise((resolve, reject) => {
    const req = request(`${base}/api/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...(host ? { Host: host } : {}) },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })));
    });
    req.on('error', reject);
    req.end(JSON.stringify({ queries: ['cypress', 'atlas', 'cypress', 'bad name!'] }));
  });
  const response = await bulk(base);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).results.length, 3);
  // A TLS-terminating proxy can use an internal HTTP URL and a public Host.
  assert.equal((await bulk('https://regcount.com', 'regcount.com')).status, 200);
  assert.equal((await bulk('https://other.example', 'regcount.com')).status, 403);
  assert.equal((await bulk('null', 'regcount.com')).status, 403);
  const liveBase = await start(port + 1, true);
  const unconfigured = await fetch(`${liveBase}/api/search?q=cypress`);
  assert.equal(unconfigured.status, 503);
  assert.match((await unconfigured.json()).error, /not been connected/);
  console.log('Passed: homepage, logo, JS/CSS, search, bulk, proxy host, cross-origin rejection, and runtime live-mode configuration.');
} finally {
  await Promise.all(servers.map(async child => {
    if (child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill('SIGTERM');
    await exited;
    clearTimeout(timer);
  }));
}
