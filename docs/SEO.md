# RegCount search visibility

Implemented September 23, 2026. RegCount remains an independent product with its own design and original content.

## Audit and approach

Before this change, the root layout sent `noindex, nofollow` for every page. The app had no XML sitemap, canonical URLs, social-preview metadata, or separate bulk-search URL. Tool navigation used client-only tabs, and the homepage changed its URL to a sample query immediately after loading.

Publicly indexed dotDB listings show descriptive search titles, keyword insight URLs, help content, and navigation to related tools. Those are useful general patterns for a research product. Direct retrieval of dotDB's homepage returned HTTP 403, so this was a review of public search listings—not an inspection of its private analytics, search volumes, backlinks, or complete technical implementation. No dotDB copy, source code, graphics, result datasets, or page layouts were copied. Existing optional provider attribution is retained.

RegCount now has nine public, indexable URLs with distinct purposes:

| URL | Topic / intent |
| --- | --- |
| `/` | Domain registration count and exact-name extension search |
| `/bulk-domain-search` | Compare a list of domain names by extension count |
| `/how-it-works` | Counting methodology, data sources, and coverage limits |
| `/about` | Product purpose, research principles, and preview status |
| `/glossary` | Eleven product-specific domain research terms and examples |
| `/guides` | Discover the research guides |
| `/guides/domain-registration-count` | Understand the meaning and limits of a count |
| `/guides/domain-extensions-explained` | Understand TLDs, ccTLDs, and multi-label suffixes |
| `/guides/compare-domain-names` | Follow a repeatable comparison and export workflow |

This topic map is an editorial plan, not a claim about keyword search volume or ranking difficulty.

## Technical behavior

- Public pages have server-rendered content, descriptive unique titles/descriptions, clean canonicals, and crawlable navigation.
- `/robots.txt` points to `/sitemap.xml`. The sitemap contains only the nine intended public pages. Dates represent this content release, not the current time on every request.
- The canonical origin is `https://regcount.com`. Requests arriving at the app with the www host permanently redirect to the same path and query on that origin. Hostinger still manages TLS and HTTP-to-HTTPS routing.
- Search-query URLs containing `q` return `noindex, follow` with a canonical to their clean tool page. Login/account pages and API endpoints return noindex. Robots.txt permits crawling of HTML pages so crawlers can actually read the noindex rules; API paths are excluded from crawling.
- Sample results are visibly labeled and wrapped in `data-nosnippet`, keeping illustrative counts out of search snippets. No pages are generated for sample keywords or unverified registration counts.
- Homepage structured data identifies the RegCount website, organization, and web application. Resource pages use breadcrumbs; guides use Article markup matching the visible byline, title, and publication date. There are no invented ratings, reviews, prices, or provider endorsements.
- Open Graph and Twitter metadata use the original branded 1200 × 630 image at `/social-image`. Existing approved logo artwork is reused unchanged. Main research-page logos use Next.js image optimization.
- Google/Bing site verification can be added through the public verification tokens described below. These are not analytics trackers.

The guides and preview copy deliberately explain the difference between registration records, domain availability, active websites, and value. Before launching live data, update the preview-specific title descriptions, FAQs, and WebApplication description to reflect the verified product state. Do not make per-keyword results indexable until there is licensed live data, useful page content, reliable refresh behavior, and a deliberate publishing policy.

## Search Console and indexing

1. Add `regcount.com` as a Domain property in [Google Search Console](https://search.google.com/search-console). Verify ownership using the DNS TXT record Google supplies at the authoritative DNS provider. This covers both protocols and subdomains.
2. If using a URL-prefix property instead, choose `https://regcount.com/`, select HTML-tag verification, and add only the token from its `content` attribute as `GOOGLE_SITE_VERIFICATION` in Hostinger. Redeploy to publish the tag. Never use an OAuth client secret as a verification token.
3. Submit `https://regcount.com/sitemap.xml` in the Sitemaps report.
4. Inspect the homepage and one guide with URL Inspection. Check the fetched title, canonical, indexing allowance, rendered content, and selected canonical. Request indexing after confirming the live page.
5. Check the Page Indexing and Performance reports over the following weeks. Review actual queries, impressions, clicks, and the pages that receive them before expanding the content.
6. Optionally verify the site in Bing Webmaster Tools. Its HTML-tag token can be set as `BING_SITE_VERIFICATION`; redeploy after changing it.

Search Console ownership verification, sitemap submission, actual index inclusion, rankings, and real-user Core Web Vitals have not been measured or completed by this code change. They require the owner's connected accounts, crawl time, or real traffic. Search engines determine indexing, snippets, sitelinks, and positions.

## Content maintenance

Keep the guides useful as the product develops: update the documented input behavior when the parser changes, refresh screenshots or examples after UI changes, and update article dates only after substantive edits. Add new pages only when they answer a distinct question and provide useful original information. Once live data is licensed and verified, consider original analyses that report their source, method, coverage, and observation date. Earn relevant references to that work through legitimate promotion; publishing pages alone does not establish reputation.

## Verification

Run `npm run build`, `npm run test:seo`, `npm run test:smoke`, and `npm run test:auth`. The SEO test checks every sitemap URL, unique metadata, HTML headings/content/links, canonicals, JSON-LD, crawler directives, query/account exclusions, unknown-guide status, www redirects, the branded PNG, and optimized logo delivery. Search and authentication tests protect the existing tools and login behavior.

## Reference material

- [dotDB public search listing example](https://dotdb.com/search?keyword=check&position=any)
- [dotDB keyword insights example](https://dotdb.com/insights/buy)
- [dotDB FAQ](https://dotdb.com/faq)
- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google snippet and data-nosnippet guidance](https://developers.google.com/search/docs/appearance/snippet)
- [Google structured site names](https://developers.google.com/search/docs/appearance/site-names)
- [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [IANA Root Zone Database](https://www.iana.org/domains/root/db)
- [ICANN RDAP](https://www.icann.org/rdap)
