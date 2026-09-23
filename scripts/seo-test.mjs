import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';

const port = Number(process.env.REGCOUNT_SEO_TEST_PORT || 3130);
const base = `http://127.0.0.1:${port}`;
const site = 'https://regcount.com';
const routes = ['/', '/bulk-domain-search', '/how-it-works', '/about', '/glossary', '/guides', '/guides/domain-registration-count', '/guides/domain-extensions-explained', '/guides/compare-domain-names'];
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, REGCOUNT_LIVE_ENABLED: 'false', DOTDB_API_KEY: '', NEXTAUTH_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
function attr(tag, name) { return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]; }
function meta(html, name) { return [...html.matchAll(/<meta\s[^>]*>/g)].map(([tag]) => tag).find(tag => attr(tag, 'name') === name || attr(tag, 'property') === name); }
function content(html, name) { return attr(meta(html, name) || '', 'content'); }
function canonical(html) { return [...html.matchAll(/<link\s[^>]*>/g)].map(([tag]) => tag).filter(tag => attr(tag, 'rel') === 'canonical').map(tag => attr(tag, 'href')); }
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, logs);
  const sitemapResponse = await fetch(base + '/sitemap.xml');
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(new Set(urls), new Set(routes.map(path => site + (path === '/' ? '' : path))));
  assert.doesNotMatch(sitemap, /\/login|\/account|\?q=|\/api\//);
  const robots = await (await fetch(base + '/robots.txt')).text();
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/(?:\r?\n|$)/);
  assert.match(robots, /Sitemap: https:\/\/regcount.com\/sitemap.xml/);
  const titles = new Set();
  const descriptions = new Set();
  const linked = new Set();
  for (const path of routes) {
    const res = await fetch(base + path, { headers: { 'User-Agent': 'Googlebot' } });
    assert.equal(res.status, 200, path);
    assert.doesNotMatch(res.headers.get('x-robots-tag') || '', /noindex/, path);
    const html = await res.text();
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = content(html, 'description');
    assert.ok(title && title.includes('RegCount'), path);
    assert.ok(description && description.length > 60, path);
    assert.ok(!titles.has(title), 'Duplicate title: ' + path);
    assert.ok(!descriptions.has(description), 'Duplicate description: ' + path);
    titles.add(title); descriptions.add(description);
    assert.match(content(html, 'robots'), /index, follow/, path);
    assert.doesNotMatch(content(html, 'robots'), /noindex/, path);
    assert.deepEqual(canonical(html), [site + (path === '/' ? '' : path)], path);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, path);
    assert.match(content(html, 'og:image'), /https:\/\/regcount.com\/social-image/);
    assert.equal(content(html, 'twitter:card'), 'summary_large_image');
    for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"#?]+)"/g)) linked.add(href);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.ok(schemas.length, 'Missing structured data: ' + path);
    if (path === '/') {
      assert.ok(schemas.some(s => s['@graph']?.some(item => item['@type'] === 'WebSite' && item.name === 'RegCount')));
      assert.match(html, /data-nosnippet/);
      assert.match(html, /Sample counts demonstrate/);
    } else {
      assert.ok(schemas.some(s => s['@type'] === 'BreadcrumbList'), path);
    }
    if (path === '/bulk-domain-search') {
      assert.match(html, /<h1>Bulk domain search/);
      assert.match(html, /<textarea[^>]+id="bulk-names"/);
      assert.doesNotMatch(html, /<h1>Domain registration counts/);
    }
    if (path.startsWith('/guides/')) {
      const article = schemas.find(s => s['@type'] === 'Article');
      assert.ok(article && article.mainEntityOfPage === site + path);
      assert.equal(article.datePublished, '2026-09-23');
      assert.match(html, /<article/);
    }
  }
  for (const route of routes) assert.ok(linked.has(route), 'Missing crawlable link: ' + route);
  for (const path of ['/?q=cypress', '/?q=does-not-exist', '/?q=', '/bulk-domain-search?q=atlas']) {
    const res = await fetch(base + path);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(content(html, 'robots'), /noindex/);
    assert.deepEqual(canonical(html), [site + (path.startsWith('/bulk-domain-search') ? '/bulk-domain-search' : '')]);
  }
  const login = await fetch(base + '/login');
  assert.match(login.headers.get('x-robots-tag'), /noindex/);
  assert.match(content(await login.text(), 'robots'), /noindex/);
  const account = await fetch(base + '/account', { redirect: 'manual' });
  assert.equal(account.status, 307);
  assert.match(account.headers.get('x-robots-tag'), /noindex/);
  assert.match((await fetch(base + '/api/search?q=cypress')).headers.get('x-robots-tag'), /noindex/);
  assert.equal((await fetch(base + '/guides/not-a-real-guide')).status, 404);
  const redirect = await new Promise((resolve, reject) => {
    const req = request(base + '/guides?ref=example', { headers: { Host: 'www.regcount.com' } }, res => {
      res.resume(); resolve({ status: res.statusCode, location: res.headers.location });
    });
    req.on('error', reject); req.end();
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.location, site + '/guides?ref=example');
  const image = await fetch(base + '/social-image');
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/png/);
  const png = Buffer.from(await image.arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  if (process.env.REGCOUNT_SEO_PREVIEW_PATH) await writeFile(process.env.REGCOUNT_SEO_PREVIEW_PATH, png);
  assert.equal((await fetch(base + '/_next/image?url=%2Fregcount-logo.png&w=64&q=75')).status, 200);
  console.log('Passed: nine public pages, unique metadata, server-rendered content, canonicals, sitemap, robots, JSON-LD, query/private exclusions, unknown-guide 404, www redirect, social PNG, and optimized logo.');
} finally {
  if (server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    server.kill('SIGTERM'); await exited; clearTimeout(timer);
  }
}
