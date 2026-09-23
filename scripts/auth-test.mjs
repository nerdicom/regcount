import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { encode } from 'next-auth/jwt';

const port = Number(process.env.REGCOUNT_AUTH_TEST_PORT || 3120);
const secret = randomBytes(48).toString('base64url');
const servers = [];
const origin = 'https://regcount.com';
async function start(number, configured) {
  const child = spawn(process.execPath, ['--import', './scripts/fixtures/auth-provider-mock.mjs', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(number)], {
    env: { ...process.env, REGCOUNT_LIVE_ENABLED: 'false', DOTDB_API_KEY: '', NEXTAUTH_URL: origin,
      NEXTAUTH_SECRET: configured ? secret : '', GOOGLE_CLIENT_ID: 'test-google-id', GOOGLE_CLIENT_SECRET: 'test-google-secret',
      FACEBOOK_CLIENT_ID: 'test-facebook-id', FACEBOOK_CLIENT_SECRET: 'test-facebook-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  const base = `http://127.0.0.1:${number}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { if ((await fetch(base)).ok) return base; } catch {}
    await delay(100);
  }
  throw new Error(`Server not ready: ${logs}`);
}
const cookieHeader = response => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
const sessionCookie = token => `__Secure-next-auth.session-token=${token}`;

try {
  const base = await start(port, true);
  const get = (path, cookie = '') => fetch(base + path, { redirect: 'manual', headers: { Cookie: cookie } });
  const post = (path, body, cookie = '') => fetch(base + path, {
    method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams(body),
  });
  const login = await get('/login');
  assert.equal(login.status, 200);
  const html = await login.text();
  assert.match(html, /Continue with Google/);
  assert.match(html, /Continue with Facebook/);
  assert.doesNotMatch(html, /test-google-secret|test-facebook-secret|Sign-in is coming soon/);
  assert.ok(!html.includes(secret));
  const protectedPage = await get('/account');
  assert.equal(protectedPage.status, 307);
  assert.equal(protectedPage.headers.get('location'), '/login?callbackUrl=%2Faccount');
  assert.deepEqual(await (await get('/api/auth/session')).json(), {});
  const providers = await (await get('/api/auth/providers')).json();
  assert.equal(providers.google.callbackUrl, origin + '/api/auth/callback/google');
  assert.equal(providers.facebook.callbackUrl, origin + '/api/auth/callback/facebook');

  for (const provider of ['google', 'facebook']) {
    // Sign-in must not start without a matching CSRF cookie/token.
    const rejected = await post(`/api/auth/signin/${provider}`, { json: 'true', callbackUrl: '/account' });
    assert.match((await rejected.json()).url, /csrf=true/);
    const csrf = await get('/api/auth/csrf');
    const csrfCookie = cookieHeader(csrf);
    assert.match(csrf.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(csrf.headers.get('set-cookie'), /Secure/i);
    assert.match(csrf.headers.get('set-cookie'), /SameSite=Lax/i);
    const { csrfToken } = await csrf.json();
    const begin = await post(`/api/auth/signin/${provider}`, { csrfToken, json: 'true', callbackUrl: '/account' }, csrfCookie);
    const target = new URL((await begin.json()).url);
    assert.equal(target.hostname, provider === 'google' ? 'accounts.google.com' : 'www.facebook.com');
    assert.equal(target.searchParams.get('redirect_uri'), origin + `/api/auth/callback/${provider}`);
    assert.ok(target.searchParams.get('state'), 'OAuth requires state');
    if (provider === 'google') {
      assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(target.searchParams.get('code_challenge'));
    } else assert.equal(target.pathname, '/v25.0/dialog/oauth');
    const invalidCallback = await get(`/api/auth/callback/${provider}?code=untrusted&state=wrong`, cookieHeader(begin));
    assert.equal(invalidCallback.status, 302);
    assert.match(invalidCallback.headers.get('location'), /error=OAuthCallback/);
    assert.ok(!invalidCallback.headers.getSetCookie().some(cookie => cookie.startsWith('__Secure-next-auth.session-token=') && !cookie.startsWith('__Secure-next-auth.session-token=;')));
  }

  // Disposable local test tokens exercise the actual encrypted-session handlers.
  // This is not an OAuth identity-provider end-to-end test.
  for (const provider of ['google', 'facebook']) {
    const token = await encode({ secret, token: { sub: `${provider}:local-test`, name: 'Domain Tester', email: provider === 'google' ? 'tester@example.test' : null, provider }, maxAge: 3600 });
    const cookie = sessionCookie(token);
    const session = await get('/api/auth/session', cookie);
    const data = await session.json();
    assert.equal(data.user.id, `${provider}:local-test`);
    assert.equal(data.provider, provider);
    assert.ok(!('accessToken' in data));
    assert.match(session.headers.get('cache-control'), /no-store/);
    const account = await get('/account', cookie);
    assert.equal(account.status, 200);
    assert.match(await account.text(), provider === 'google' ? /tester@example.test/ : /Not shared by your provider/);
    for (const bad of ['https://evil.example/path', '//evil.example', '/\\evil.example', origin + '//evil.example', '/api/auth/signin', '/login']) {
      const returned = await get(`/login?callbackUrl=${encodeURIComponent(bad)}`, cookie);
      assert.equal(returned.headers.get('location'), '/account');
    }
    assert.equal((await get('/login?callbackUrl=%2F%3Fq%3Datlas', cookie)).headers.get('location'), '/?q=atlas');
    const csrf = await get('/api/auth/csrf', cookie);
    const cookieWithCsrf = cookie + '; ' + cookieHeader(csrf);
    const { csrfToken } = await csrf.json();
    const invalidSignout = await post('/api/auth/signout', { json: 'true' }, cookieWithCsrf);
    assert.ok(!invalidSignout.headers.getSetCookie().some(value => value.startsWith('__Secure-next-auth.session-token=;')));
    const signout = await post('/api/auth/signout', { json: 'true', csrfToken, callbackUrl: 'https://evil.example' }, cookieWithCsrf);
    assert.equal((await signout.json()).url, origin + '/account');
    assert.ok(signout.headers.getSetCookie().some(value => value.startsWith('__Secure-next-auth.session-token=;') && /Max-Age=0/i.test(value)));
  }
  const expired = await encode({ secret, token: { sub: 'expired' }, maxAge: -120 });
  const foreign = await encode({ secret: randomBytes(32).toString('hex'), token: { sub: 'foreign' } });
  for (const token of ['forged-token', expired, foreign]) {
    assert.deepEqual(await (await get('/api/auth/session', sessionCookie(token))).json(), {});
    assert.equal((await get('/account', sessionCookie(token))).status, 307);
  }
  const disabled = await start(port + 1, false);
  assert.deepEqual(await (await fetch(disabled + '/api/auth/session')).json(), {});
  assert.deepEqual(await (await fetch(disabled + '/api/auth/providers')).json(), {});
  assert.match(await (await fetch(disabled + '/login')).text(), /Sign-in is coming soon/);
  assert.equal((await fetch(disabled + '/api/auth/signin/google', { method: 'POST' })).status, 503);
  assert.equal((await fetch(disabled + '/api/search?q=cypress')).status, 200);
  console.log('Passed: login, server account guard, provider redirects, CSRF/state/PKCE, safe return URLs, encrypted sessions, missing Facebook email, invalid/expired cookies, sign-out, and missing configuration.');
} finally {
  await Promise.all(servers.map(async child => {
    if (child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill('SIGTERM'); await exited; clearTimeout(timer);
  }));
}
