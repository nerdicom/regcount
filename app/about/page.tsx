import Link from 'next/link';
import { ArrowRight, Crosshair, Eye, Layers3 } from 'lucide-react';
import { ContentLayout } from '@/components/content-layout';
import { NameIllustration } from '@/components/name-illustration';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('About RegCount: Built for Domain People', 'Meet RegCount, an independent domain research tool for exploring exact-name extension counts, comparing shortlists, and understanding the source behind a result.', '/about');

export default function AboutPage() {
  return <ContentLayout label="ABOUT REGCOUNT" title="For people who see possibility in a name." intro="The good ones stick with you. RegCount is a place to explore what sits beyond a name’s first extension—and bring a little more context to your domain research." breadcrumbs={[{ name: 'About', path: '/about' }]}>
    <section className="about-story"><div><span className="eyebrow">WHY REGCOUNT EXISTS</span><h2>There’s more to a name than its .com.</h2><p>A name can appear across different extensions, markets, and projects. Seeing those suffixes together gives you another way to explore a keyword, compare alternatives, and ask better questions.</p><p>RegCount brings exact-name search, extension filters, bulk comparison, and CSV exports into one workspace. It is designed for domain collectors, people naming their next project, and anyone who enjoys going a little deeper into a shortlist.</p><p>We focus on making the count understandable: what was matched, which source it came from, and what you can reasonably learn from it.</p></div><NameIllustration/></section>
    <section className="about-principles"><div className="section-intro"><span className="eyebrow">OUR APPROACH</span><h2>Useful research starts with clear boundaries.</h2></div><div className="feature-grid">
      <div className="feature-card"><div className="feature-icon feature-teal"><Crosshair size={23}/></div><h3>Keep the definition clear.</h3><p>An exact-name count and a list of related names answer different questions. RegCount keeps them separate so you can understand the result.</p></div>
      <div className="feature-card"><div className="feature-icon feature-orange"><Eye size={23}/></div><h3>Show where the number comes from.</h3><p>Illustrative samples and provider results carry different labels. Unknown results stay unknown, and exported data keeps its source attached.</p></div>
      <div className="feature-card"><div className="feature-icon feature-violet"><Layers3 size={23}/></div><h3>Support your own judgment.</h3><p>A count is one piece of a research process. It is not a domain appraisal, proof of availability, or a measure of how many active businesses use a name.</p></div>
    </div></section>
    <section className="project-status"><span className="status-tag">PRODUCT PREVIEW</span><div><h2>Where the project stands.</h2><p>The public preview lets you explore the workflow with labeled sample names. Until a live provider is connected, those counts and extension lists are illustrative. Read the source label on every result.</p><p>RegCount is an independent product. A data provider’s attribution identifies a source, not an endorsement or affiliation.</p><Link href="/how-it-works">See the data and methodology <ArrowRight size={16}/></Link></div></section>
    <section className="content-callout"><h2>Start with a name you’re curious about.</h2><p>Explore the sample collection, compare a shortlist, or read a guide to understand the details behind the number.</p><Link href="/">Explore domain search <ArrowRight size={16}/></Link><Link href="/guides">Browse the guides <ArrowRight size={16}/></Link></section>
  </ContentLayout>;
}
