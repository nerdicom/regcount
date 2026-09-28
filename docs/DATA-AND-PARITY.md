# RegCount: data access and feature parity

This is the implementation roadmap, not a claim that RegCount already has the
same coverage or every feature as dotDB. Reviewed September 27, 2026 against
dotDB's public [search](https://dotdb.com/search?keyword=agent&position=any),
[FAQ](https://dotdb.com/faq), [API documentation](https://dotdb.com/api-document),
[pricing](https://dotdb.com/pricing), and [keyword insights](https://dotdb.com/insights).

## What this release changes

| Capability | RegCount implementation | Remaining work |
| --- | --- | --- |
| Exact name and related names | Existing search stays available | Expand the underlying data |
| Multiple keywords | Ordered word matching with spaces | Shuffle/unordered matching and Unicode input |
| Advanced filtering | Length, excluded words, selected TLDs, numbers, hyphens, and punycode IDNs | Website status filters require real activity observations |
| Global count sorting | The new endpoint aggregates all filtered matches before sorting | Measure latency on the production dataset; common short queries can exceed the budget |
| Pagination | 50 related names per page, up to 100 pages; snapshot changes require a new search | Background query/export jobs for larger results |
| Keyword and domain totals | Counts all filtered names and name/TLD pairs in covered zones | Totals remain unknown after a timeout; never substitute a sample ranking |
| CSV | Current result page, with query, filters, snapshot, coverage, and explicit scope | Complete-result export jobs, persisted manifests, expiry, and quotas |
| Coverage statistics | Current imported extension totals and freshness | Historical snapshots and growth statistics |
| Bulk search | Existing 50-name exact comparisons | Persisted jobs for up to 10,000 keywords, quotas, progress, retries, and download storage |
| Active/parked/inactive | Not checked | Isolated crawler, DNS/IP validation on every hop, parking classification, timestamps, TTL, and crawl budgets |
| Domain monitoring/portfolio | Not implemented | Persistent accounts, saved lists, snapshot comparisons, scheduler, notification preferences and delivery |
| Public customer API | Existing private API is service-to-service only | Customer tokens, scopes, metering, rate limits and billing |
| Keyword insights/trends | Not implemented | Licensed search-volume/CPC provider and historical observations |

The public search and pricing pages describe a substantially wider product than
registration counting alone. Their data coverage is not a guarantee of every
registered domain: dotDB's own FAQ explains DNS and update-cycle omissions.

## Priority extension sources

### .com, then .net and .name

[Verisign directs zone-file requests through ICANN CZDS](https://www.verisign.com/resources/zone-file/).
Check the account's current approval records at
<https://czds.icann.org/zone-requests/all>. The installed importer can also list
approved downloadable extensions without downloading a zone:

```sh
regcount-czds approved
```

Approval and import scheduling are separate. The existing bounded queue does
not automatically add .com or .net after approval. The importer currently has
pilot and medium budgets only; .com must not be forced into the medium queue.

Before enabling large zones, measure compressed/expanded sizes, working disk,
current database/index sizes and memory. Benchmark one representative staged
import, index build, and common searches while existing imports keep running.
Budget for both old and replacement partitions, staging files, indexes, WAL,
and a disk reserve. Then add a reviewed large-zone profile and queue entry.
Keep daily download spacing, transactional partition swaps, checksum validation,
and the existing count-drop guard. Approval alone does not establish capacity.

### .ai

[IANA's current delegation record](https://www.iana.org/domains/root/db/ai.html)
identifies the Government of Anguilla, the registration service at
<https://nic.ai>, and the administrative contact
`telecommunications.office@gov.ai`. Request bulk domain/zone access for the
public research service or ask for an authorized commercial data distributor.
The RDAP endpoint listed there is a lookup service, not evidence of bulk rights.
No .ai bulk-access approval has been verified for RegCount.

### .si

[Register.si's contact page](https://www.register.si/en/contact-and-location/)
identifies ARNES as the operator and `info@register.si` as its general contact.
Ask whether a recurring domain/zone feed can be licensed for a public commercial
search product. No .si bulk-access approval has been verified for RegCount.

### .io

[IANA lists Internet Computer Bureau as the .io operator](https://www.iana.org/domains/root/db/io.html).
A WHOIS lookup is not a bulk domain feed. No recurring .io source with permission
for RegCount search and exports has been configured. Obtain an authorized feed
and its format before connecting it to the index.

### .xyz

The existing CZDS queue includes .xyz. Coverage is determined from committed
imports returned by the private API, never by a hard-coded count or the mere
presence of .xyz in the schedule. The coverage page highlights all five requested
extensions: .ai, .si, .com, .xyz and .io.

### Commercial supplier candidate

[Domains Monitor's extension catalog](https://domains-monitor.com/domainzones/)
lists .ai and .si datasets, and its [FAQ](https://domains-monitor.com/faq/)
describes automated downloads. This is a candidate to contact, not an approved
feed: its [standard terms](https://domains-monitor.com/terms/) prohibit using
the data for a competing service and restrict redistribution. A normal
subscription therefore is not the proposed integration path. Request a
separate written license for RegCount's search, export and API uses from
`info@domains-monitor.com`, plus coverage evidence and a sample. No purchase
or communication has been made. Vendor counts are observations, not proof of
complete registry coverage.

### Information to obtain from each registry or supplier

- Named extensions, coverage definition, current record count, and snapshot time.
- Update schedule, full snapshots/deltas, encoding and file format.
- Permission for public keyword results, derived counts, caching, customer API,
  and customer exports; identify any limits on redistribution separately.
- Attribution, retention, deletion, pricing and volume limits.
- Sample data for validation and an authenticated recurring delivery mechanism.

The product requirements for an inquiry are: RegCount is a public domain
research service operated by Nerdi, LLC. It needs domain names and source dates
for exact counts and keyword searches, without registrant contact information.
Request permission for the intended display, export and API uses explicitly.
This document does not send an inquiry or buy a subscription.

## Supplemental-source integration contract

The current storage and API explicitly describe **CZDS DNS-delegated domains**.
A licensed domain list cannot be silently inserted and presented as a complete
CZDS zone. Before connecting a supplemental source, add per-source provenance:
source ID, evidence basis (zone/registry registration/observed domain), coverage
scope, snapshot date, import date, completeness, and retention/usage constraints.
Deduplicate name/suffix pairs across sources while retaining their evidence.
Keep incomplete observations distinct from complete zone snapshots; a missing
name in an incomplete feed remains unknown. Expand the suffix model for
multi-part ccTLD suffixes, using the Public Suffix List and source-specific rules.

Add the provider adapter after the actual format and agreement are known.
Import a sample first, validate the full feed, then enable the source in search.
Display the source and coverage on results and exports. Do not infer availability
or website activity from domain-list presence.

## Deployment of this release

1. Update the private search service using its existing installer pinned to the
   reviewed commit. This preserves its existing database, token, hostname,
   importer credentials and schedule. Run `regcount-search status` afterward,
   followed by `regcount-search verify-advanced`. The latter reports API latency
   and flags resource-limited queries without displaying credentials.
2. Test advanced queries on the real imported dataset. Check common words,
   multiple words, extension filters and later pages. Record latency and resource
   use. The service keeps its read-only role, four-query concurrency cap, request
   limit, 2.5-second advanced query budget, and database temp-file limit.
3. Deploy the website commit through its existing Hostinger GitHub workflow.
   Basic search and the coverage dashboard work with the existing service. The
   website enables advanced controls only when `/v1/status` explicitly advertises
   `capabilities.advancedSearch: true`. Older services, failed status checks and
   unavailable providers leave advanced controls disabled. Saved advanced URLs
   report the limitation without calling an unsupported endpoint. It does not
   substitute the old first-100 selection or silently return demo data.
4. Verify live coverage, real counts, paging and CSV labels after deployment.
   No production credentials or environment settings are changed by the PR.

Local tests run real SQL in PGlite using synthetic records, including a highly
registered name alphabetically beyond the old 100-name cutoff. Those tests
establish query correctness, not production speed or capacity.

## Current activation boundary

The GitHub connection can publish website and service code. It does not grant
access to the separate VPS database or ICANN account. Completing missing feeds
requires authenticated VPS access, current CZDS approvals for .com, measured
large-zone capacity, and an approved recurring source for .ai, .si and .io.
Public RDAP/WHOIS lookups are not substituted for an indexed keyword-search feed.
No downloader budgets, importer schedule, credentials or existing data are changed
by this website compatibility fix.
