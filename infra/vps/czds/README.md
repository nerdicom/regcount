# CZDS single-zone pilot

This adds private download, parsing and indexed storage to the existing
PostgreSQL VPS foundation. It does not change the website, publish a search API,
download all approved zones, or enable an unattended schedule.

The [coverage priorities](COVERAGE.md) track the ten required extensions,
supplemental country-code sources and the checks needed before claiming live
coverage. The pilot limits do not yet support an unmeasured .com import.

## Install and first import

Use `infra/vps/install-czds.sh` from a reviewed immutable commit. Pass the same
40-character commit SHA as its sole argument. The installer downloads only the
five production files in this directory and verifies `SHA256SUMS`. It leaves
the existing PostgreSQL password, Compose configuration and volume intact.
It requires root, Python 3.11+, Docker Compose, curl, flock and sha256sum.

The installer creates the restricted `regcount_ingest` database role and
`domain_index` schema. The role has no password and cannot authenticate over
the network; the root-operated importer uses local socket authentication via
`docker compose exec -T db psql`. No database port is published. This role owns
only its index schema; the future API should use a separate read-only role.

Run each command individually in the VPS terminal:

```sh
regcount-czds configure
```

Enter your ICANN account email and password at the prompts. The password is
hidden, verified with ICANN, then saved in a root-only file (not encrypted at
rest). It is never put in shell history, command arguments, logs or GitHub.

```sh
regcount-czds approved
```

This lists approved download links without fetching any zone data. Choose one
small approved extension. If `.zone` is listed, use:

```sh
regcount-czds sync zone
```

```sh
regcount-czds status
```

Expected status includes the extension, unique delegated-domain count, SOA
serial, download timestamp and import timestamp. The count is observed from
the zone file, not a claimed count of every registered domain. Do not infer
availability from a name's absence. CZDS does not supply all ccTLDs.

## Data and recovery behavior

- A streaming parser extracts direct-child NS owners. Apex records, A/AAAA
  glue records and deeper names are excluded. Repeated NS records collapse to
  one `(label, tld)` row. Punycode labels are retained in ASCII.
- Each extension has an indexed PostgreSQL partition. A refresh prepares a
  replacement inside one transaction, checks it, and switches it into the
  parent table only when ready. Existing rows and metadata survive failed or
  interrupted preparation. The final switch briefly locks the parent table.
- The importer verifies the compressed SHA-256, gzip integrity, apex SOA and
  nonempty delegation data. It rejects older/ambiguous serials using 32-bit
  serial arithmetic, and rejects decreases greater than 20% by default.
- `$ORIGIN`, `$TTL`, multiline parentheses, comments and omitted owners are
  supported. `$INCLUDE`, `$GENERATE`, malformed relevant records and uncommon
  non-hostname delegation labels stop the import for review. This is a
  deliberately conservative DNS master-file subset, not a full DNS validator.
- Download attempts are recorded **before** making the request. Each extension
  is limited to one attempt per 24 hours, even after a failed transfer. This
  local history cannot track downloads made through the portal/another client:
  choose a zone you have not downloaded elsewhere in the previous 24 hours.
- A complete cached download can be reprocessed without downloading it again:

```sh
regcount-czds import-cache zone
```

After independently reviewing a legitimate decline greater than 20%, the same
command accepts `--allow-large-drop`. This does not bypass download cadence.
An empty zone always requires code/operator review. Do not delete attempt
history to force another download.

On an uncertain disconnect during the final commit, run `status` first: the
transaction may have committed. Rerunning `import-cache` is idempotent for the
same verified snapshot. On HTTP authentication/access errors, check ICANN
credentials and registry approvals; the importer does not retry automatically.
Redirects and unfamiliar download hosts are refused to avoid forwarding the
bearer token to another service.

## Larger files and capacity checks

The default `pilot` profile remains unchanged. For a zone such as `.app` that
exceeds the compressed pilot cap, install the updated code from a reviewed
commit, then inspect local capacity without making an ICANN request:

```sh
regcount-czds capacity app --profile medium
```

This reports free space on both the cache and Docker database-volume
filesystems, database size, cached-file presence and the exact next eligible
download time in UTC. It does not download data or reset attempt history.
An installer upgrade preserves existing credentials, cached files, cadence
history and database rows; there is no need to run `configure` again.

Once the disk check passes and the download timer is ready:

```sh
regcount-czds sync app --profile medium
```

The medium profile permits up to 1 GiB compressed / 8 GiB expanded, with at
least 60 GiB free before both download and import. This is a conservative
starting budget, not a guarantee that any particular zone fits. Limits are
shared by the downloader, parser, cache validation and SQL metadata checks.
The 20 GiB stop reserve is still checked throughout processing on both
filesystems. Temporary sort files remain limited to 4 GiB per process.

A transfer stopped at the compressed cap has no complete new cached file;
wait until the displayed eligibility time. A complete download whose *import*
fails can be reprocessed after addressing the error without another download:

```sh
regcount-czds import-cache app --profile medium
```

Neither profile bypasses the 24-hour attempt limit. Broad ingestion and
`.com`/`.net` still require access verification, benchmarks and a storage plan.

## Resource limits

| Limit | Value |
| --- | --- |
| Compressed zone | Pilot: 256 MiB; medium: 1 GiB |
| Expanded zone | Pilot: 2 GiB; medium: 8 GiB |
| Free space before download/import | Pilot: 20 GiB; medium: 60 GiB |
| Logical record | 64 KiB |
| Free disk reserve | 20 GiB |
| PostgreSQL sort/temp files for ingest role | 4 GiB per process |
| PostgreSQL statement timeout | 30 minutes |
| Concurrent local importers | 1 |

Disk checks run during transfer, parsing, and database preparation. The
20 GiB reserve is a stop threshold, not a filesystem quota; concurrent writes
and PostgreSQL WAL can overshoot it. The expanded parser limit is not an estimate
of total disk use. Database staging, indexes, sorting and WAL all need space.
These limits target a small pilot on KVM 4. `.com`, `.net`, and broad ingestion
need a capacity benchmark and a planned storage budget before increasing them.

Files live under `/opt/regcount-data/czds` (root, mode 700):

- `credentials.json`: account credentials (mode 600).
- `cache/<tld>.zone.gz`: most recent complete private download.
- `cache/<tld>.json`: checksum and download metadata.
- `cache/<tld>.attempt.json`: persistent download cadence history.
- `app`: symlink to the immutable installed code release.

Raw zone data must remain private and be used under the registry's accepted
terms. Do not commit it, expose the cache over HTTP, or build public bulk
exports. Keep the credentials and cadence history in restricted backups.
This pilot does not configure off-server backups or a tested restore.

## Validation

Run the parser, download-safety and process-abort tests with:

```sh
python3 -m unittest discover -s infra/vps/czds -p 'test_*.py' -v
```

The 24 Python tests include simulated installer reruns and upgrades from the
four-file release, checksum failures, separate database filesystem checks,
profile consistency and preserving credentials/download history. A failed
disk preflight must not consume a download attempt; a failed transfer must.

`test-postgres.mjs` tests the generated DDL/DML in a disposable PGlite
PostgreSQL 17.5 instance with synthetic zone records: unique counts, another
extension, atomic replacement, rejected count drop, rejected stale serial,
reviewed drop and interrupted transaction rollback. It also checks that failed
imports leave both previous metadata and domains unchanged. See its header for
the separate test-only dependency command; it is not a website dependency.

The embedded database uses a file-device COPY adapter in place of psql's
STDIN, and its synthetic database catalog does not support the database-level
GRANT. User-provided VPS output on 2026-09-23 confirms native PostgreSQL 17.11
schema setup, ICANN authentication, 853 approved links, and successful imports
of `.zone` (31,719) and `.dev` (767,025). The next `.app` transfer stopped at the
original 256 MiB compressed cap and left those rows intact. The new medium
profile still needs a VPS capacity check and a complete real-zone benchmark.
No live credentials or registry data were used in local tests.

## After the pilot

Validate the first real zone's count and disk use, then add an explicit approved
zone list and a refresh schedule at least 24 hours apart with failure alerts.
Before connecting the public website, add an authenticated HTTPS API, a
read-only database role, rate limits, coverage/freshness labels and restricted
backups with a restore test. This commit deliberately keeps the website's
current data-provider setting unchanged.

## Sources

- [ICANN CZDS Python reference client](https://github.com/icann/czds-api-client-python)
- [DNS master-file format, RFC 1035 section 5](https://www.rfc-editor.org/rfc/rfc1035#section-5)
- [Serial number arithmetic, RFC 1982](https://www.rfc-editor.org/rfc/rfc1982)
- [PostgreSQL COPY](https://www.postgresql.org/docs/17/sql-copy.html)
- [PostgreSQL partitioning](https://www.postgresql.org/docs/17/ddl-partitioning.html)
