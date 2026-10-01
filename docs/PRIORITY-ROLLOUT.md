# Priority coverage and search rollout

## Verified October 1, 2026, 18:48 UTC

Production reports 14 indexed extensions; `.com`, `.net`, `.ai`, `.io`,
`.si`, `.so`, and `.top` are absent. Advanced search is disabled.
The live `cypress` query returns nine exact extensions but times out on related names.

The September 30 ICANN approval message for `.top` was read in the connected
`info@regcount.com` inbox. The last deployed importer schedules only 15 explicit
extensions and does not contain `.top`. Approval alone never schedules a zone.
The new priority reconciliation command addresses that gap.

No newer `.com` or `.net` approval notice appeared among messages received since
the September 28 mailbox check. The current authenticated CZDS download list is
the authority, not an email count. `.com` also needs a measured capacity plan;
this change deliberately does not invent a large-zone budget or force it into
the existing medium profile.

The `.si` and `.de` registries declined complete lists on September 28. The `.ru`
registry also declined in its September 29 reply. `.io` has only acknowledged
receipt; no `.ai` or UK-family response appeared in the checked messages. Junk
and Trash were empty. These facts are dated evidence, not permanent registry
policy claims or a claim that independently licensed observed data cannot exist.

## Changes

- Bring the installed importer implementation from `infra/czds-importer` into
  `main`, so service and importer upgrades can use one reviewed commit.
- `regcount-czds priorities` reconciles 37 important generic extensions and 18
  country-code namespaces against current approvals, queue entries and committed
  imports. It reports `.com` capacity and country-code source blockers separately.
- `regcount-czds priorities --apply --limit 10` adds at most ten approved generic
  extensions, subject to the existing 50-entry queue and 60 GiB free-space check.
  It saves the previous queue, preserves private state and review flags, and never
  downloads a zone itself. Repeat deliberately for another bounded batch.
- Every new import builds a GIN trigram index before swapping its partition.
  Failed parsing, index creation, disk checks or count guards roll back together.
  An interrupted import now explicitly cancels its own PostgreSQL backend before
  closing the transaction, including a running index build.
- Related substring searches materialize their filter before alphabetical
  selection, letting PostgreSQL use the trigram index. Beginning searches keep
  the ordered B-tree path. Existing query budgets and truthful timeout results stay.
- Advanced controls are advertised only after every committed partition has a
  valid, complete trigram index. Ordinary exact-name searches stay available.
- `regcount-czds reindex TLD` rebuilds one partition using only the cache matching
  that exact committed snapshot. It does not request another registry download,
  reset download timers or relax count/serial guards.

## Deployment sequence

Use the existing root VPS terminal/authorized command connection. GitHub or the
website deployment alone cannot install these changes on the separate data VPS.
Pin both existing installers to the same reviewed 40-character commit SHA.

1. Record `regcount-czds progress`, `regcount-czds approved`, and
   `regcount-czds capacity app --profile medium`. Confirm actual available space
   before adding index/storage work. If an import is running, let it finish.
2. Run `bash infra/vps/install-czds.sh REVIEWED_SHA`. It preserves credentials,
   download history, existing data, queue entries, and systemd units. It installs
   `pg_trgm` in `public` before switching to the new importer release.
3. Run `regcount-czds priorities`, inspect the ready-to-queue list, then
   `regcount-czds priorities --apply --limit 10`. `.top` should be selected only
   if the current CZDS download list still authorizes it. `.net` is selected if
   currently approved; `.com` remains blocked for a separate capacity review.
4. Reindex one small committed cache first (`regcount-czds reindex zone`),
   measuring elapsed time, disk, WAL and memory. Continue one imported zone at
   a time when capacity remains adequate. If the cache is missing/different,
   leave the published data intact and let the normal scheduled refresh build
   its index. Do not bypass the daily download limit.
5. Run `bash infra/vps/install-search.sh REVIEWED_SHA`; then `regcount-search status`
   and `regcount-search verify-advanced`. After all partitions have valid indexes,
   status advertises advanced search. Verify common words, multiple words,
   paging, counts and CSV in production. Local tests do not establish production
   latency, capacity or completion.
6. Confirm newly imported extensions in `https://regcount.com/api/coverage`.
   A queued or approved extension is not covered until its import commits.

Both old code releases remain on disk for rollback. Do not roll the importer
back to a version that recreates partitions without substring indexes while
claiming advanced readiness. Do not drop existing domain data to recover space.

## Remaining external requirements

Full `.ai`, `.io`, `.si`, `.co`, `.me`, `.tv`, `.cc`, `.so`, `.us`, `.uk`/
`.co.uk`, `.de`, `.ca`, `.au`/`.com.au`, `.in`, `.cn` and `.ru` keyword coverage
requires verified recurring sources with appropriate public-search rights.
No such source or credentials have been supplied for this update. Do not label
individual RDAP/WHOIS lookups, certificate observations or sample lists as complete
registration indexes. Add source provenance and multi-part suffix handling with
the actual chosen feed, and keep omissions unknown.

WhoisXML API documents a commercial MSA and License & Use Exhibit for public
product use; standard internal-use access is insufficient. Domains Monitor's
standard terms restrict competing services. No purchase or license acceptance
was performed. Supplier coverage, freshness, format and price must be confirmed
before an adapter can honestly mark these extensions connected.

References: PostgreSQL pg_trgm https://www.postgresql.org/docs/current/pgtrgm.html;
Verisign CZDS access https://www.verisign.com/resources/zone-file/;
WhoisXML API commercial terms https://main.whoisxmlapi.com/terms-of-service.
