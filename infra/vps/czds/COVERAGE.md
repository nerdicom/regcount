# RegCount coverage priorities

Required extensions, specified by Nick on 2026-09-23:

**.com .net .org .ai .si .io .xyz .app .dev .so**

These are coverage requirements, not a statement that data has been imported.
The VPS pilot installed successfully on 2026-09-23. ICANN authentication returned
HTTP 401 during configuration, before retrieving approval links or any zones.
No live index coverage has been demonstrated yet.

## Acquisition routes

| Extensions | Planned source | Remaining work |
| --- | --- | --- |
| .com, .net | Verisign through ICANN CZDS | Verify account approval, benchmark large-zone storage and imports |
| .org | PIR through ICANN CZDS | Verify account approval and import capacity |
| .xyz, .app, .dev | ICANN CZDS, subject to registry approval | Verify current approved links, import and validate |
| .ai, .io | Registry agreement or licensed supplemental source | Confirm access, refresh frequency, completeness and public-product rights |
| .si | Register.si agreement or licensed source; official RDAP for individual checks | Confirm bulk access; evaluate permitted cached exact-name lookups |
| .so | soNIC/registry agreement or licensed source | Confirm a supported bulk feed or permitted lookup service |

The four country-code extensions must not be assumed to be included merely
because RegCount has CZDS access. No bulk-feed agreement or license for those
extensions is currently confirmed. Contacting registries, accepting new terms,
and buying data are separate steps, not actions already completed.

For an exact-name search such as `cypress`, an approved lookup service can
potentially check `cypress.si` without maintaining the complete .si zone. That
would provide a per-query result, not complete bulk coverage or substring
search. Registry terms, rate limits, positive/negative caching, error handling
and cost must be reviewed before enabling that approach. DNS resolution alone
does not establish registration or availability.

## Next coverage group

After the required ten, investigate:

.co, .me, .tv, .cc, .us, .uk, .de, .ca, .au, .eu,
.info, .biz, .online, .site, .store, .shop, .tech, .cloud, .pro, .name.

This is a priority list, not an exhaustive definition of common extensions.
National namespaces with registrations under suffixes such as `.co.uk` or
`.com.au` need their own public-suffix handling and source coverage; the current
direct-child CZDS parser must not be reused blindly for those namespaces.

## Conditions before advertising live coverage

1. Verify actual source access for each required extension. A submitted request
   or a generic registry policy is not evidence that this account has access.
2. Distinguish source availability, registry approval, completed imports and
   fresh query results. Show missing or failed extensions as **unknown**, not
   as unregistered and not as a silently excluded zero.
3. Keep per-extension provenance and timestamps. Zone snapshots describe
   delegated domains; they can omit registered domains with no delegation or
   certain statuses. Display counts with their coverage and freshness scope.
4. Avoid double counting when a domain appears in both a zone and a supplemental
   source. Keep exact-name results separate from substring/related-name counts.
5. Budget and benchmark .com/.net before enabling large loads. The installed
   pilot deliberately caps files at 256 MiB compressed / 2 GiB expanded and
   is not an implementation or capacity guarantee for the full .com zone.
6. Validate terms, access controls, query limits, backups and freshness monitoring
   before connecting live sources to the public website.

## Verified references

- [Verisign zone-file access](https://www.verisign.com/resources/zone-file/)
  explicitly directs .com and .net access to CZDS and explains zone omissions.
- [PIR zone access](https://pir.org/our-domains/become-a-registrar/)
  directs .org zone-file users to CZDS.
- [ICANN CZDS](https://www.icann.org/en/contracted-parties/registry-operators/services/centralized-zone-data-service)
  describes participating gTLD access and the new-gTLD requirement.
- [IANA root database](https://www.iana.org/domains/root/db)
  identifies country-code managers and registry contacts; it is not a list of
  all registered second-level domains.
- [Register.si RDAP](https://www.register.si/en/rdap/)
  documents individual domain queries, HEAD requests and response semantics.
- [Official ICANN authentication client](https://github.com/icann/czds-api-client-python/blob/master/do_authentication.py)
  classifies authentication HTTP 401 as invalid username/password.
