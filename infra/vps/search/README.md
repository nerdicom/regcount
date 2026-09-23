# CZDS search adapter

This optional service queries an existing CZDS domain index. It does not download
zones or enable live website data automatically. Deployment requires a separately
configured database connection and authenticated HTTPS access.

## Search behavior

- Exact and bulk searches return extension counts for names in imported zones.
- Bulk requests accept up to 50 names.
- Related searches support any position, beginning and end, with a minimum of
  three characters. They return at most 100 alphabetically selected matching
  names, with complete extension counts for those names. Sorting that selection
  by count is not a global top-100 ranking; truncation is labeled.
- Related queries have a time limit. If it is reached, the exact-name count is
  retained and the response explains that related results are incomplete.
- Responses include covered extensions, snapshot download times and missing
  priority extensions. Snapshots older than 72 hours are flagged.
- Counts describe DNS-delegated domains in covered snapshots, not all registered
  domains or active websites. Zero does not establish availability.
- The website uses illustrative data until explicitly configured. Connection
  failures in live mode never silently substitute sample results.

## Validation

The website adapter tests run with `npm run test:czds`. Service tests use actual
PostgreSQL SQL in disposable PGlite with synthetic records. They cover matching,
bounded results, timeout recovery, read-only grants, partition replacement,
authentication, malformed requests, rate limits and concurrency. Python tests
cover configuration preservation and refusal of conflicting settings.

These tests do not establish production capacity. Native PostgreSQL login,
container startup, HTTPS, networking and query speed must be verified in the
actual deployment before enabling the live website connection. No live
credentials or zone data are used in the automated tests.

References: [node-postgres](https://node-postgres.com/features/queries),
[PostgreSQL indexes](https://www.postgresql.org/docs/17/indexes-types.html),
[Caddy HTTPS](https://caddyserver.com/docs/automatic-https).
