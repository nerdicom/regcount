import Link from 'next/link';

export function SiteFooter() {
  return <footer className="site-footer research-footer">
    <div><Link className="footer-brand" href="/">RegCount<b>.</b></Link><span>Built for domain people.</span></div>
    <nav aria-label="Research resources">
      <Link href="/">Domain search</Link><Link href="/bulk-domain-search">Bulk search</Link><Link href="/how-it-works">How it works</Link><Link href="/guides">Domain guides</Link>
    </nav>
  </footer>;
}
