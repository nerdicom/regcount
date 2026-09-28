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

### Advanced search v2

`GET /v2/search` adds ordered multiple keywords, length/exclusion/character/TLD
filters, global counts, deterministic count sorting, and 50-name pages. It keeps
the v1 endpoints unchanged. Query options are shared with the website in
`query.mjs`; user input is never interpolated into SQL. The first page returns
a coverage snapshot ID required for later pages. A changed snapshot returns
409; requesting a missing TLD returns 422 instead of a fabricated zero.

Global matching uses the existing read-only database role and a 2.5-second
statement budget. Memory/temp-file limits and the four-request concurrency
cap remain in force. When a query exceeds its budget, exact results remain
available and global totals are null. No partial candidate set is presented as
a global ranking. Pages are limited to the first 100; CSV exports in this
release contain the displayed page, not an unlimited complete dataset.

Production latency needs measurement on native PostgreSQL with the real data.
See [data acquisition, parity gaps and deployment](../../../docs/DATA-AND-PARITY.md).

The service installer includes `advanced.mjs` and `query.mjs` in its pinned
checksum manifest. The website checks `/v1/status` for `capabilities.advancedSearch: true` before
enabling advanced controls. Older services still support basic search and the
coverage dashboard. Install and verify this service revision to enable advanced
filters. Existing credentials, import schedules, and hostname are retained.

### Verify the installed release

After the pinned installer finishes, run:

```sh
regcount-search status
regcount-search verify-advanced
```

The second command makes at most seven sequential, read-only requests inside
the API container. It checks common keywords, count ranking, multiple keywords,
combined filters and a second page when one is available. Timed requests carry
the initial snapshot to bypass the response cache and detect an intervening
import. The existing query and request limits remain in force. Output includes
aggregate counts and API timings; the token stays inside its secret mount.

`LIMIT` or an error exits unsuccessfully: review that result before enabling the
website controls. A changed snapshot means an import completed during the check;
run the command again. `SKIP` means pagination still needs checking with a query
that has another page. This is a small deployment check, not a concurrent load
test or proof that large zones will fit. `status` separately verifies configured
HTTPS; this command measures the private API path only.

### Local checks

Use `npm test` in this directory with `@electric-sql/pglite` available, or set
`PGLITE_MODULE` to its absolute module path. The website's `npm run test:research`
uses the same dependency and runs actual SQL responses through its adapter.

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
