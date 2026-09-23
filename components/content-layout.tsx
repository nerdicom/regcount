import Link from 'next/link';
import Image from 'next/image';
import { AccountLink } from '@/components/account-controls';
import { SiteFooter } from '@/components/site-footer';
import { StructuredData } from '@/components/structured-data';
import { breadcrumbData } from '@/lib/seo';

export function ContentLayout({ title, intro, label = 'DOMAIN RESEARCH', breadcrumbs, children }: {
  title: string; intro: string; label?: string; breadcrumbs: { name: string; path: string }[]; children: React.ReactNode;
}) {
  const trail = [{ name: 'Home', path: '/' }, ...breadcrumbs];
  return <div className="site-shell content-shell">
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" href="/" aria-label="RegCount home"><Image src="/regcount-logo.png" alt="" width={56} height={56}/><span>Reg<span className="brand-count">Count</span><b>.</b></span></Link>
      <nav className="research-nav" aria-label="Main navigation"><Link href="/">Domain search</Link><Link href="/bulk-domain-search">Bulk search</Link><Link href="/guides">Guides</Link></nav>
      <AccountLink/>
    </div></header>
    <main id="content" className="content-main">
      <nav className="breadcrumbs" aria-label="Breadcrumb">{trail.map((item, i) => <span key={item.path}>{i > 0 && <span aria-hidden="true">/</span>}{i === trail.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}</span>)}</nav>
      <div className="content-intro"><div className="eyebrow">{label}</div><h1>{title}</h1><p>{intro}</p></div>
      {children}
    </main>
    <SiteFooter/><StructuredData value={breadcrumbData(trail)}/>
  </div>;
}
