import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { StructuredData } from '@/components/structured-data';
import { breadcrumbData } from '@/lib/seo';

export function ContentLayout({ title, intro, label = 'DOMAIN RESEARCH', breadcrumbs, children }: {
  title: string; intro: string; label?: string; breadcrumbs: { name: string; path: string }[]; children: React.ReactNode;
}) {
  const trail = [{ name: 'Home', path: '/' }, ...breadcrumbs];
  return <div className="site-shell content-shell">
    <a className="skip-link" href="#content">Skip to content</a>
    <SiteHeader active={breadcrumbs[breadcrumbs.length - 1]?.path}/>
    <main id="content" className="content-main">
      <nav className="breadcrumbs" aria-label="Breadcrumb">{trail.map((item, i) => <span key={item.path}>{i > 0 && <span aria-hidden="true">/</span>}{i === trail.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}</span>)}</nav>
      <div className="content-intro"><div className="eyebrow">{label}</div><h1>{title}</h1><p>{intro}</p></div>
      {children}
    </main>
    <SiteFooter/><StructuredData value={breadcrumbData(trail)}/>
  </div>;
}
