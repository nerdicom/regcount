# RegCount

A responsive domain registration research application with exact-name search, extension filtering, related names, bulk comparison (50 names), and CSV export. The approved globe logo is in public/regcount-logo.png.

## Data mode

The VPS connection is prepared in [the CZDS search service](infra/vps/search/README.md).
It adds a protected HTTPS API, a read-only database role, bulk exact-name queries,
bounded keyword matching, and coverage/download-time labels in the website and CSV.
Set `REGCOUNT_DATA_SOURCE=czds` and its two private connection variables only after
the VPS install and HTTPS checks pass. `REGCOUNT_LIVE_ENABLED` remains the switch.
`npm run test:czds` validates the website adapter without real credentials.

The initial release uses explicitly labeled illustrative sample data. Counts and extension lists in demo mode are not registration facts. An unknown sample returns null, never a fabricated zero. Demo flags are carried into CSV exports and agent tools.

A server-side dotDB v2 adapter is implemented in lib/registration-provider.ts. It has not been tested with an actual key. Before enabling it, confirm that your provider agreement allows displaying data in this service. Set REGCOUNT_LIVE_ENABLED=true and DOTDB_API_KEY as a server secret. Never expose the key to the browser. These same keys are documented in .env.example; hosted values must be set through the hosting environment, not committed.

The adapter requests https://api.dotdb.com/v2/search using the documented Token authentication, exact_match_total_suffix, and matches/suffixes fields. It caches queries for five minutes per server process. It does not silently replace failed live responses with sample data. The bulk endpoint performs bounded concurrent single-name searches; a 50-name comparison can consume up to 100 provider calls when exact-match fallback is needed. Provider quotas and public-site rate limiting must be configured before a public launch. The existing hosted preview is owner-private; repository visibility does not change preview access.

Country-code classification uses a two-character final DNS label, including .ai, .io, .co, and multi-part suffixes like .co.uk. Internationalized input needs punycode. Enter a keyword or a registrable domain, not a subdomain. The current keyword normalizer takes the first label after stripping www. Coverage and freshness depend on the provider, and missing results do not establish availability.

## Results layout

Search opens a full-width name overview with summary counts, a pinned exact-match row, sortable related counts, and all returned extensions displayed as wrapping links. Extension filters change the visible lists without changing Count or Active totals. The Extension cards tab retains the exact-name grid and copy action. CSV exports reflect the selected view and retain sample/source labels. Partial extension lists are identified explicitly.

Keyword-position radio buttons offer Any position (default), Beginning, and End. Changing an option reruns the current query; `position=beginning` or `position=end` is retained in shareable search URLs and restores on reload. The mode controls related-name matching, while the exact-name count stays separate. CSV files and WebMCP results include the selected mode. Bulk comparisons still report exact-name counts.

The search API accepts `position=any|beginning|end` and rejects other values. The dotDB adapter forwards the documented `position` parameter and caches each query/position separately (see https://dotdb.com/api-document). Demo searches use a fixed illustrative collection, so partial keywords can find related samples even when an exact-name count is unknown; unknown counts remain null. Production live-provider access is still not enabled by these controls.

The optional `activeCount` on search results and related matches means a verified active website count. Current sample and dotDB adapters do not supply website-activity data, so the interface and CSV show “Not checked.” Missing activity is never inferred from zone presence or treated as zero; a supplied zero remains zero. This layout does not connect the VPS data pipeline or implement website crawling.

## Revenue paths

The search and bulk pages show a labeled Nerdi owner promotion linking to the existing $500 website-design offer, and search includes a DNLaunch marketplace referral. Both links use fixed `utm_source=regcount` campaign tags. They never append the searched name or account information, suppress the page referrer, and load no advertising scripts. These are referrals to businesses under the same ownership, not activated registrar affiliate accounts.

`/advertise` offers a clearly labeled search sponsorship. Its CTA opens an email draft to `info@regcount.com`; the visitor sends it themselves. It does not charge, book dates, deliver email through the server, or promise an audience size. Confirm terms, collect payment through your chosen billing process, and approve campaign copy before activating a sponsor.

To replace the Nerdi slot with a paid sponsor, set all five `REGCOUNT_SPONSOR_*` values from `.env.example` in Hostinger, then redeploy. HTTPS destination URLs are required; URLs containing credentials and incomplete/oversized copy fall back to the owner promotion. The slot and disclosure are server-rendered, and `rel="sponsored noopener noreferrer"` is applied. Remove the values and redeploy to restore the owner promotion. Read-only query and bulk results remain unaffected by sponsor settings.

Domain-registrar commissions and recurring subscriptions are not configured. A real affiliate account/tracking link or payment service and account entitlements would be needed before enabling those revenue paths.

## Development

This repository is a standard Next.js application for Node.js hosting. The earlier private preview used Cloudflare; this GitHub version no longer requires that runtime.

Requires Node.js 22.13 or newer and npm (included with Node.js):

```sh
npm ci
cp .env.example .env
npm run dev
```

The local server runs on port 3000. For a production build:

```sh
npm run build
npm start
```

The server binds to `0.0.0.0` and uses `PORT` when provided (otherwise 3000). Registration-provider settings are read from server-side `process.env` at runtime.

## Hostinger deployment

Use Hostinger **Node.js Web App** deployment with GitHub, rather than the PHP/static Git deployment that only copies source into `public_html`.

| Setting | Value |
| --- | --- |
| Repository | `nerdicom/regcount` |
| Branch | `main` |
| Framework | Next.js (server-side) |
| Node.js | 22.x or 24.x |
| Root directory | `./` |
| Package manager | npm |
| Install command, if requested | `npm ci` |
| Build command | `npm run build` |
| Build output directory | `.next` |
| Start command, if requested | `npm start` |

Leave `REGCOUNT_LIVE_ENABLED=false` while reviewing sample data. No API key or database is needed in demo mode. Configure live-provider credentials in Hostinger's Environment Variables, never in GitHub.

If the log reports a missing `corepack/.../pnpm/.../bin/pnpm.cjs`, change Hostinger's package manager to **npm** and its build command to **npm run build**. This repository uses `package-lock.json` and does not require pnpm or Corepack.

After changing deployment settings, redeploy the latest commit. Hostinger creates the routing from the domain to its Node process. If a successful Node deployment still returns 403, inspect its deployment/runtime logs and the generated `public_html/.htaccess` routing. Source files alone in `public_html` do not run this application.

## Branding and publishing

Social sign-in is available once the OAuth providers below are configured. No paid plans are implemented. Public tool and guide pages are indexable. Query results and account pages remain noindex; sample counts are excluded from snippets. See [the SEO guide](docs/SEO.md) for the page map, Search Console setup, and live-data publishing checklist. DNS and Hostinger account settings are managed separately from this repository. Uploading source to GitHub alone does not start the hosted application.

## Verification

The npm migration was verified with a clean `npm ci`, production build, and HTTP smoke tests on Node.js 22.18.0 with npm 10.9.3.

`npm run build` compiles the production Next.js server and checks TypeScript. Then run `npm run test:smoke` to verify the homepage, logo, JS/CSS assets, single/bulk search, public Host routing behind a proxy, cross-origin rejection, and live mode without a key. Tests use local demo data and do not call dotDB.

`npm run test:search` checks provider position parameters, mode-specific caching, exact-match fallback, partial coverage, and sample substring matching with deterministic mocked responses. The smoke suite also checks all three radio options and API modes. No real provider credentials or network requests are used by the adapter test.


TypeScript passed. Desktop and a 390px responsive frame were checked in the browser. Search normalization, extension filters, unknown-name null results, bulk deduplication, invalid rows, data explanations, and exported CSV contents were verified. The CSV export retains sample labels and escapes formula-like cell values. WebMCP actions are feature-detected, but the QA browser did not expose modelContext, so that optional integration could not be exercised. Live provider responses require a licensed API key and have not been integration-tested.

## Google and Facebook login

Login is at `/login`; `/account` is protected on the server. The header shows **Log in** or **My account**, and the account page includes sign-out. Guest search remains available. Both providers create an encrypted, HTTP-only session cookie with a seven-day lifetime. Provider access tokens are not stored in the session or sent to the browser. Google and Facebook identities are separate; matching email addresses are not automatically linked. Facebook accounts without email are supported.

This release uses stateless sessions, without a customer database, stored searches, password login, or account linking. Sign-out clears the browser session; it does not revoke provider consent or sign out other devices. Add persistent users before attaching subscriptions or saved research to an account.

Add these **server-side environment variables** in the Hostinger Node.js deployment settings, then redeploy. Do not put secrets in GitHub or variables prefixed with `NEXT_PUBLIC_`.

| Variable | Value |
| --- | --- |
| `NEXTAUTH_URL` | `https://regcount.com` |
| `NEXTAUTH_SECRET` | A persistent random value generated by `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google's OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google's OAuth client secret |
| `FACEBOOK_CLIENT_ID` | Meta's app ID |
| `FACEBOOK_CLIENT_SECRET` | Meta's app secret |

The secret must be at least 32 characters. Changing it logs out existing sessions. For local development use `NEXTAUTH_URL=http://localhost:3000` and separate development credentials. Missing settings leave the relevant login button disabled with a clear visitor message; the rest of the site stays usable. You can enable Google first and Facebook later.

### Google

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview), select or create the RegCount project, and configure branding/audience and the consent screen.
2. Create an OAuth client for a **Web application**.
3. Set the authorized JavaScript origin to `https://regcount.com` and the authorized redirect URI to **`https://regcount.com/api/auth/callback/google`**.
4. Copy the client ID and client secret into the Hostinger variables above. While the app is in testing, add your Google account as a test user. Complete the Google publishing requirements before allowing everyone to sign in.

Reference: [NextAuth Google setup](https://next-auth.js.org/providers/google).

### Facebook

1. Open [Meta for Developers](https://developers.facebook.com/apps/), create/select the RegCount app, and add the Facebook Login use case for a website.
2. Set the app domain to `regcount.com`, site URL to `https://regcount.com`, and the valid OAuth redirect URI to **`https://regcount.com/api/auth/callback/facebook`**. Enable web OAuth login and require HTTPS.
3. Copy the app ID and app secret into Hostinger's `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`.
4. Test with an app administrator/tester. Complete the privacy policy, user-data deletion instructions, and any access/review or verification requirements shown by Meta before publishing the app for other users. These policy pages need the operator's actual contact and data practices; this code does not invent those details.

Facebook uses Graph API v25.0 with `public_profile` and `email`. No friends, posts, or page permissions are requested. Reference: [NextAuth Facebook setup](https://next-auth.js.org/providers/facebook) and [Meta's v25 release](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/).

### Authentication verification

After a build, run `npm run test:auth` for missing-configuration behavior, protected accounts, provider URLs, CSRF/state protection, safe return URLs, session validation/expiry, and sign-out. Tests mock Google discovery, block external provider calls, create disposable local session credentials, and never log in to a real Google or Facebook account. Run `npm run test:smoke` for existing search behavior. Real provider consent and callback completion must also be checked after adding the production client credentials.
