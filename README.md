# RegCount

A responsive domain registration research application with exact-name search, extension filtering, related names, bulk comparison (50 names), and CSV export. The approved globe logo is in public/regcount-logo.png.

## Data mode

The initial release uses explicitly labeled illustrative sample data. Counts and extension lists in demo mode are not registration facts. An unknown sample returns null, never a fabricated zero. Demo flags are carried into CSV exports and agent tools.

A server-side dotDB v2 adapter is implemented in lib/registration-provider.ts. It has not been tested with an actual key. Before enabling it, confirm that your provider agreement allows displaying data in this service. Set REGCOUNT_LIVE_ENABLED=true and DOTDB_API_KEY as a server secret. Never expose the key to the browser. These same keys are documented in .env.example; hosted values must be set through the hosting environment, not committed.

The adapter requests https://api.dotdb.com/v2/search using the documented Token authentication, exact_match_total_suffix, and matches/suffixes fields. It caches queries for five minutes per server process. It does not silently replace failed live responses with sample data. The bulk endpoint performs bounded concurrent single-name searches; a 50-name comparison can consume up to 100 provider calls when exact-match fallback is needed. Provider quotas and public-site rate limiting must be configured before a public launch. The existing hosted preview is owner-private; repository visibility does not change preview access.

Country-code classification uses a two-character final DNS label, including .ai, .io, .co, and multi-part suffixes like .co.uk. Internationalized input needs punycode. Enter a keyword or a registrable domain, not a subdomain. The current keyword normalizer takes the first label after stripping www. Coverage and freshness depend on the provider, and missing results do not establish availability.

## Development

This repository is a standard Next.js application for Node.js hosting. The earlier private preview used Cloudflare; this GitHub version no longer requires that runtime.

Requires Node.js 22.13 or newer and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The local server runs on port 3000. For a production build:

```sh
pnpm build
pnpm start
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
| Package manager | pnpm |
| Install command, if requested | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Build output directory | `.next` |
| Start command, if requested | `pnpm start` |

Leave `REGCOUNT_LIVE_ENABLED=false` while reviewing sample data. No API key or database is needed in demo mode. Configure live-provider credentials in Hostinger's Environment Variables, never in GitHub.

After changing deployment settings, redeploy the latest commit. Hostinger creates the routing from the domain to its Node process. If a successful Node deployment still returns 403, inspect its deployment/runtime logs and the generated `public_html/.htaccess` routing. Source files alone in `public_html` do not run this application.

## Branding and publishing

No customer accounts or paid plans are implied. Noindex is enabled while the data connection is unfinished. Switch it deliberately when the service is ready to launch. DNS and Hostinger account settings are managed separately from this repository. Uploading source to GitHub alone does not start the hosted application.

## Verification

`pnpm build` compiles the production Next.js server and checks TypeScript. Then run `pnpm test:smoke` to verify the homepage, logo, JS/CSS assets, single/bulk search, public Host routing behind a proxy, cross-origin rejection, and live mode without a key. Tests use local demo data and do not call dotDB.


TypeScript passed. Desktop and a 390px responsive frame were checked in the browser. Search normalization, extension filters, unknown-name null results, bulk deduplication, invalid rows, data explanations, and exported CSV contents were verified. The CSV export retains sample labels and escapes formula-like cell values. WebMCP actions are feature-detected, but the QA browser did not expose modelContext, so that optional integration could not be exercised. Live provider responses require a licensed API key and have not been integration-tested.
