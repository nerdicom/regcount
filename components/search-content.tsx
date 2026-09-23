import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { GuideCards } from '@/components/guide-cards';

export function SearchContent({ bulk = false }: { bulk?: boolean }) {
  return <div className="search-content search-content-compact">
    <section className="search-explainer">
      <div><span className="eyebrow">{bulk ? 'A CONSISTENT COMPARISON' : 'THE NAME BEHIND THE NUMBER'}</span><h2>{bulk ? 'Bulk domain research, with the details intact.' : 'What is a domain registration count?'}</h2><p>{bulk ? 'Compare up to 50 entries in one batch, combine repeated keywords, sort by reported extension count, and export the results for your own research notes.' : 'A domain registration count measures how many distinct extensions appear for the same exact name in a data source. It helps you explore a name’s recorded presence across suffixes such as .com, .net, and .co.uk.'}</p><p>{bulk ? 'Use the same input rules and data source across a shortlist. Then open individual results to inspect the extension mix behind each total. An unknown result stays unknown; it is not assigned a zero.' : 'Related names are shown separately from the exact-match total. A longer name containing the same word does not add an extension to the original name’s count.'}</p><Link className="guide-cta" href="/how-it-works">Understand the methodology<ArrowUpRight size={16}/></Link></div>
      <ol className="research-steps">
        <li><strong>{bulk ? 'Prepare your list' : 'Start with the exact name'}</strong><p>{bulk ? 'Use one keyword per line. Remove duplicates before submitting more than 50 entries.' : 'Enter a keyword or a registrable domain. Use the keyword directly when your input contains subdomains.'}</p></li>
        <li><strong>{bulk ? 'Compare, then inspect' : 'Read the count and the source'}</strong><p>{bulk ? 'Sort the list and examine the actual suffixes. Registration breadth is one research signal.' : 'Check whether you are viewing an illustrative sample or provider data, then filter the extension list.'}</p></li>
        <li><strong>Keep the context</strong><p>Export the source label with your results and verify a specific domain’s status separately.</p></li>
      </ol>
    </section>
    <section className="search-faq"><div className="faq-intro"><span className="eyebrow">GOOD QUESTIONS</span><h2>{bulk ? 'Before you compare your list.' : 'A little more clarity.'}</h2><p>Understand what you’re seeing, then decide what to investigate next.</p><Link href="/how-it-works">Read the methodology <ArrowUpRight size={15}/></Link></div><div className="faq-items">
      {(bulk ? [
        ['How many names can I compare?', 'The bulk form accepts up to 50 input entries per request. Normalized duplicates are combined in the results. Newlines, spaces, commas, and semicolons separate entries.'],
        ['What happens to unknown or invalid names?', 'Rows without a usable count display a dash and, when available, an explanatory note. In sample mode, names outside the example collection are unknown—not confirmed unregistered.'],
        ['Can I export the comparison?', 'Yes. The CSV includes each normalized keyword, its count, the data source, and any row note. Sample exports remain labeled as illustrative data.'],
        ['Can I inspect the extensions behind a count?', 'Yes. Select a name in the comparison to open its individual search. The extension view includes category filters and a suffix filter.'],
      ] : [
        ['Does RegCount currently show live registration data?', 'The public preview uses labeled sample data until a live provider is connected. Read the source label on each response. Sample counts do not establish actual registrations.'],
        ['Does a missing extension mean a domain is available?', 'No. A registration index can have coverage gaps or delayed updates. Check the specific domain with a registrar or the relevant registration-data service before relying on its status.'],
        ['Is an extension count a domain appraisal?', 'No. The count describes coverage in a source. It does not establish traffic, revenue, ownership, or a sale price.'],
        ['What should I type into the search?', 'Start with a keyword such as cypress. A domain such as cypress.com is normalized to the name. For inputs with subdomains, enter the underlying keyword directly.'],
        ['Do I need an account to explore the tools?', 'No. You can use domain search, bulk comparison, filters, and CSV exports without signing in.'],
        ['Why are related names separate?', 'A longer name containing your keyword is a different exact name. For example, getcypress.com does not add an extension to the exact-name count for cypress.'],
      ]).map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </div></section>
    <section className="learning-section" aria-labelledby="learn-domain-research"><div className="content-section-heading"><div><span className="eyebrow">THE RESEARCH NOTEBOOK</span><h2 id="learn-domain-research">A better feel for the numbers.</h2></div><Link href="/guides">Explore all guides<ArrowUpRight size={15}/></Link></div><GuideCards/></section>

  </div>;
}
