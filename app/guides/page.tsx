import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ContentLayout } from '@/components/content-layout';
import { GuideCards } from '@/components/guide-cards';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Domain Research Guides', 'Learn how to interpret domain registration counts, understand extensions, and compare a shortlist with practical, original RegCount research guides.', '/guides');
export default function GuidesPage() {
  return <ContentLayout title="Get more from your domain research." intro="Practical explanations for the numbers, extensions, and decisions behind a domain shortlist." breadcrumbs={[{ name: 'Guides', path: '/guides' }]}>
    <GuideCards heading="h2"/>
    <section className="glossary-banner"><div><span className="eyebrow">SPEAK DOMAIN</span><h2>Exact match? Suffix? Registration count?</h2><p>Get comfortable with the language behind your research.</p></div><Link className="secondary-button" href="/glossary">Open the glossary <ArrowUpRight size={16}/></Link></section>
    <section className="content-callout"><h2>Know the source before you use the number.</h2><p>RegCount labels illustrative samples and provider results. Our methodology explains exact matching, duplicate handling, input limits, and the difference between an unknown result and zero.</p><Link href="/how-it-works">Read how RegCount works <ArrowUpRight size={16}/></Link></section>
  </ContentLayout>;
}
