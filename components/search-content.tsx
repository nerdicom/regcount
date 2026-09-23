import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Crosshair, Download, Layers3 } from 'lucide-react';
import { GuideCards } from '@/components/guide-cards';

export function SearchContent({ bulk = false }: { bulk?: boolean }) {
  return <div className="search-content">
    <section className="toolkit-section" aria-labelledby="research-toolkit"><div className="section-intro"><span className="eyebrow">LESS GUESSWORK. MORE CONTEXT.</span><h2 id="research-toolkit">Small details. Better domain research.</h2><p>Go from an interesting name to an organized shortlist, with the information behind each count close at hand.</p></div>
      <div className="feature-grid">
        <div className="feature-card"><div className="feature-icon feature-teal"><Crosshair size={23}/></div><span className="feature-number">01 / EXPLORE</span><h3>Focus on the exact name.</h3><p>See distinct suffixes for the same keyword. Filter the extension list and keep longer, related names separate from the total.</p><Link href="/guides/domain-registration-count">Read a registration count <ArrowRight size={15}/></Link></div>
        <div className="feature-card"><div className="feature-icon feature-orange"><Layers3 size={23}/></div><span className="feature-number">02 / COMPARE</span><h3>Give your shortlist context.</h3><p>Compare up to 50 entries, combine repeated names, and sort by extension count before inspecting individual results.</p><Link href="/bulk-domain-search">Try bulk search <ArrowRight size={15}/></Link></div>
        <div className="feature-card"><div className="feature-icon feature-violet"><Download size={23}/></div><span className="feature-number">03 / KEEP</span><h3>Take your research with you.</h3><p>Copy domains or download a CSV. Source labels travel with your export, so sample data stays clearly identified in your notes.</p><Link href="/guides/compare-domain-names">Build a repeatable workflow <ArrowRight size={15}/></Link></div>
      </div>
    </section>
    <section className="search-explainer">
      <div><span className="eyebrow">{bulk ? 'A CONSISTENT COMPARISON' : 'THE NAME BEHIND THE NUMBER'}</span><h2>{bulk ? 'Bulk domain research, with the details intact.' : 'What is a domain registration count?'}</h2><p>{bulk ? 'Compare up to 50 entries in one batch, combine repeated keywords, sort by reported extension count, and export the results for your own research notes.' : 'A domain registration count measures how many distinct extensions appear for the same exact name in a data source. It helps you explore a name’s recorded presence across suffixes such as .com, .net, and .co.uk.'}</p><p>{bulk ? 'Use the same input rules and data source across a shortlist. Then open individual results to inspect the extension mix behind each total. An unknown result stays unknown; it is not assigned a zero.' : 'Related names are shown separately from the exact-match total. A longer name containing the same word does not add an extension to the original name’s count.'}</p><Link className="guide-cta" href="/how-it-works">Understand the methodology<ArrowUpRight size={16}/></Link></div>
      <ol className="research-steps">
        <li><strong>{bulk ? 'Prepare your list' : 'Start with the exact name'}</strong><p>{bulk ? 'Use one keyword per line. Remove duplicates before submitting more than 50 entries.' : 'Enter a keyword or a registrable domain. Use the keyword directly when your input contains subdomains.'}</p></li>
        <li><strong>{bulk ? 'Compare, then inspect' : 'Read the count and the source'}</strong><p>{bulk ? 'Sort the list and examine the actual suffixes. Registration breadth is one research signal.' : 'Check whether you are viewing an illustrative sample or provider data, then filter the extension list.'}</p></li>
        <li><strong>Keep the context</strong><p>Export the source label with your results and verify a specific domain’s status separately.</p></li>
      </ol>
    </section>
    <section className="audience-section"><div className="section-intro"><span className="eyebrow">FOR THE NAME-OBSESSED</span><h2>Different projects. The same curiosity.</h2><p>Whether you have one idea or a spreadsheet full of them, start with a clearer view of the name.</p></div><div className="audience-grid">
      <div><span>DOMAIN COLLECTORS</span><h3>Know what’s around your name.</h3><p>Inspect the extension mix around a keyword you own or are considering. Use it to frame further research into individual domains.</p></div>
      <div><span>FOUNDERS & MAKERS</span><h3>Put a naming idea in context.</h3><p>Compare candidates before committing to a brand. Registration breadth can prompt useful questions about distinctiveness and alternatives.</p></div>
      <div><span>PORTFOLIO RESEARCHERS</span><h3>Make a long list manageable.</h3><p>Work through a batch, sort the results, and bring a labeled export into your own notes or spreadsheet.</p></div>
    </div></section>
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
    <section className="closing-callout"><div><span className="eyebrow">CURIOSITY LOOKS GOOD ON YOU.</span><h2>Have a few names in mind?</h2><p>Put them side by side. Start with the samples and explore the details.</p></div><Link className="primary-button" href="/bulk-domain-search">Compare a shortlist <ArrowRight size={17}/></Link></section>
  </div>;
}
