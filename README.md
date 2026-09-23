# RegCount

A responsive domain registration research application with exact-name search, extension filtering, related names, bulk comparison (50 names), and CSV export. The approved globe logo is in public/regcount-logo.png.

## Data mode

The initial release uses explicitly labeled illustrative sample data. Counts and extension lists in demo mode are not registration facts. An unknown sample returns null, never a fabricated zero. Demo flags are carried into CSV exports and agent tools.

A server-side dotDB v2 adapter is implemented in lib/registration-provider.ts. It has not been tested with an actual key. Before enabling it, confirm that your provider agreement allows displaying data in this service. Set REGCOUNT_LIVE_ENABLED=true and DOTDB_API_KEY as a server secret. Never expose the key to the browser. These same keys are documented in .env.example; hosted values must be set through the hosting environment, not committed.

The adapter requests https://api.dotdb.com/v2/search using the documented Token authentication, exact_match_total_suffix, and matches/suffixes fields. It caches queries for five minutes per worker instance. It does not silently replace failed live responses with sample data. The bulk endpoint performs bounded concurrent single-name searches; a 50-name comparison can consume up to 100 provider calls when exact-match fallback is needed. Provider quotas and public-site rate limiting must be configured before a public launch. The existing hosted preview is owner-private; repository visibility does not change preview access.

Country-code classification uses a two-character final DNS label, including .ai, .io, .co, and multi-part suffixes like .co.uk. Internationalized input needs punycode. Enter a keyword or a registrable domain, not a subdomain. The current keyword normalizer takes the first label after stripping www. Coverage and freshness depend on the provider, and missing results do not establish availability.

## Development

Requires Node.js 22.13 or newer and pnpm 11.25.0. From a clean clone:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The local development server runs on port 5173. To create a production build, run `pnpm build`. `pnpm start` runs the built Cloudflare Worker locally through Wrangler; it is not a public deployment command.

 This checkout uses the Sites Vinext/Cloudflare starter and managed preview configuration. Keep .openai/hosting.json and the build plugin intact for Sites deployments. A Hostinger/Node deployment will need a platform adapter or a standard Next.js build configuration; it is not a drop-in Cloudflare Worker deployment.

## Branding and publishing

No customer accounts or paid plans are implied. Noindex is enabled while the data connection is unfinished. Switch it deliberately when the service is ready to launch. The custom domain regcount.com has not been connected or modified.

## Verification

TypeScript passed. Desktop and a 390px responsive frame were checked in the browser. Search normalization, extension filters, unknown-name null results, bulk deduplication, invalid rows, data explanations, and exported CSV contents were verified. The CSV export retains sample labels and escapes formula-like cell values. WebMCP actions are feature-detected, but the QA browser did not expose modelContext, so that optional integration could not be exercised. Live provider responses require a licensed API key and have not been integration-tested.
