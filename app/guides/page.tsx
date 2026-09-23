import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ContentLayout } from '@/components/content-layout';
import { guides } from '@/lib/guides';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Domain Research Guides', 'Learn how to interpret domain registration counts, understand extensions, and compare a shortlist with practical, original RegCount research guides.', '/guides');
export default function GuidesPage() {
  return <ContentLayout title="Get more from your domain research." intro="Practical explanations for the numbers, extensions, and decisions behind a domain shortlist." breadcrumbs={[{ name: 'Guides', path: '/guides' }]}>
    <div className="guide-grid">{guides.map(guide => <Link className="guide-card" href={`/guides/${guide.slug}`} key={guide.slug}>
      <span className="guide-meta">{guide.readingTime}</span><h2>{guide.title}</h2><p>{guide.description}</p><span className="guide-cta">Read the guide<ArrowUpRight size={16}/></span>
    </Link>)}</div>
    <section className="content-callout"><h2>Know the source before you use the number.</h2><p>RegCount labels illustrative samples and provider results. Our methodology explains exact matching, duplicate handling, input limits, and the difference between an unknown result and zero.</p><Link href="/how-it-works">Read how RegCount works <ArrowUpRight size={16}/></Link></section>
  </ContentLayout>;
}
