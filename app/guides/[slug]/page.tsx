import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentLayout } from '@/components/content-layout';
import { StructuredData } from '@/components/structured-data';
import { guides } from '@/lib/guides';
import { CONTENT_DATE, SITE_URL, pageMetadata } from '@/lib/seo';

export function generateStaticParams() { return guides.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = guides.find(g => g.slug === slug);
  return article ? pageMetadata(article.title, article.description, `/guides/${slug}`) : { title: 'Guide not found', robots: { index: false, follow: false } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides.find(g => g.slug === slug);
  if (!guide) notFound();
  const path = `/guides/${guide.slug}`;
  return <ContentLayout title={guide.title} intro={guide.intro} label="THE REGCOUNT FIELD GUIDE" breadcrumbs={[{ name: 'Guides', path: '/guides' }, { name: guide.title, path }]}>
    <div className="article-meta">By RegCount · {guide.readingTime} · Published <time dateTime={CONTENT_DATE}>September 23, 2026</time></div>
    <div className="article-layout">
      <aside className="article-toc"><span>IN THIS GUIDE</span><nav aria-label="On this page">{guide.sections.map((section, i) => <a key={section.heading} href={`#section-${i + 1}`}>{section.heading}</a>)}</nav></aside>
      <article className="guide-prose">{guide.sections.map((section, i) => <section id={`section-${i + 1}`} key={section.heading}>
        <h2>{section.heading}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}
        {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
        {section.table && <div className="content-table-wrap" role="region" aria-label={section.heading} tabIndex={0}><table><thead><tr>{section.table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{section.table.rows.map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>}
      </section>)}
      {guide.sources.length > 0 && <section><h2>Further reading</h2><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.label}</a></li>)}</ul></section>}
      <section className="content-callout"><h2>Put the workflow to work.</h2><p>Explore RegCount’s labeled sample collection, compare a list, and inspect the extensions behind a count.</p><Link href="/">Open domain search</Link><Link href="/bulk-domain-search">Try bulk comparison</Link></section>
      <section><h2>Keep exploring</h2><ul>{guides.filter(g => g.slug !== slug).map(g => <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>)}<li><Link href="/how-it-works">RegCount methodology and data coverage</Link></li></ul></section>
      </article>
    </div>
    <StructuredData value={{ '@context': 'https://schema.org', '@type': 'Article', headline: guide.title, description: guide.description, mainEntityOfPage: `${SITE_URL}${path}`, datePublished: CONTENT_DATE, dateModified: CONTENT_DATE, author: { '@type': 'Organization', name: 'RegCount', url: SITE_URL }, publisher: { '@type': 'Organization', name: 'RegCount', url: SITE_URL }, inLanguage: 'en' }}/>
  </ContentLayout>;
}
