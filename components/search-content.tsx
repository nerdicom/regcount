import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { guides } from '@/lib/guides';

export function SearchContent({ bulk = false }: { bulk?: boolean }) {
  return <div className="search-content">
    <section className="search-explainer">
      <div><span className="eyebrow">{bulk ? 'A CONSISTENT COMPARISON' : 'THE NAME BEHIND THE NUMBER'}</span><h2>{bulk ? 'Bulk domain research, with the details intact.' : 'What is a domain registration count?'}</h2><p>{bulk ? 'Compare up to 50 entries in one batch, combine repeated keywords, sort by reported extension count, and export the results for your own research notes.' : 'A domain registration count measures how many distinct extensions appear for the same exact name in a data source. It helps you explore a name’s recorded presence across suffixes such as .com, .net, and .co.uk.'}</p><p>{bulk ? 'Use the same input rules and data source across a shortlist. Then open individual results to inspect the extension mix behind each total. An unknown result stays unknown; it is not assigned a zero.' : 'Related names are shown separately from the exact-match total. A longer name containing the same word does not add an extension to the original name’s count.'}</p><Link className="guide-cta" href="/how-it-works">Understand the methodology<ArrowUpRight size={16}/></Link></div>
      <ol className="research-steps">
        <li><strong>{bulk ? 'Prepare your list' : 'Start with the exact name'}</strong><p>{bulk ? 'Use one keyword per line. Remove duplicates before submitting more than 50 entries.' : 'Enter a keyword or a registrable domain. Use the keyword directly when your input contains subdomains.'}</p></li>
        <li><strong>{bulk ? 'Compare, then inspect' : 'Read the count and the source'}</strong><p>{bulk ? 'Sort the list and examine the actual suffixes. Registration breadth is one research signal.' : 'Check whether you are viewing an illustrative sample or provider data, then filter the extension list.'}</p></li>
        <li><strong>Keep the context</strong><p>Export the source label with your results and verify a specific domain’s status separately.</p></li>
      </ol>
    </section>
    <section className="search-faq"><h2>{bulk ? 'Before you compare your list' : 'Domain search questions, answered'}</h2>
      {(bulk ? [
        ['How many names can I compare?', 'The bulk form accepts up to 50 input entries per request. Normalized duplicates are combined in the results. Newlines, spaces, commas, and semicolons separate entries.'],
        ['What happens to unknown or invalid names?', 'Rows without a usable count display a dash and, when available, an explanatory note. In sample mode, names outside the example collection are unknown—not confirmed unregistered.'],
        ['Can I export the comparison?', 'Yes. The CSV includes each normalized keyword, its count, the data source, and any row note. Sample exports remain labeled as illustrative data.'],
      ] : [
        ['Does RegCount currently show live registration data?', 'The public preview uses labeled sample data until a live provider is connected. Read the source label on each response. Sample counts do not establish actual registrations.'],
        ['Does a missing extension mean a domain is available?', 'No. A registration index can have coverage gaps or delayed updates. Check the specific domain with a registrar or the relevant registration-data service before relying on its status.'],
        ['Is an extension count a domain appraisal?', 'No. The count describes coverage in a source. It does not establish traffic, revenue, ownership, or a sale price.'],
      ]).map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>
    <section aria-labelledby="learn-domain-research"><div className="content-section-heading"><h2 id="learn-domain-research">Build a better domain shortlist.</h2><Link href="/guides">All guides<ArrowUpRight size={15}/></Link></div><div className="guide-grid">{guides.map(guide => <Link key={guide.slug} className="guide-card" href={`/guides/${guide.slug}`}><span className="guide-meta">{guide.readingTime}</span><h3>{guide.title}</h3><p>{guide.description}</p><span className="guide-cta">Read the guide<ArrowUpRight size={16}/></span></Link>)}</div></section>
  </div>;
}
