import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function SiteFooter() {
  return <footer className="product-footer">
    <div className="footer-main">
      <div className="footer-intro"><Link className="footer-wordmark" href="/">RegCount<b>.</b></Link><p>A little clarity for your<br/>domain obsession.</p><span className="footer-signature"><span className="tiny-bars" aria-hidden="true"><i/><i/><i/></span>Built for domain people.</span></div>
      <nav aria-label="Research tools"><h2>Research</h2><Link href="/">Domain search</Link><Link href="/bulk-domain-search">Bulk comparison</Link><Link href="/how-it-works">How it works</Link></nav>
      <nav aria-label="Learning resources"><h2>Learn</h2><Link href="/guides">Domain guides</Link><Link href="/glossary">Domain glossary</Link><Link href="/guides/compare-domain-names">Build a shortlist</Link></nav>
      <nav aria-label="About RegCount"><h2>RegCount</h2><Link href="/about">About the project</Link><Link href="/advertise">Advertise with us</Link><Link href="/how-it-works">Data & methodology</Link><Link href="/login">Your account <ArrowUpRight size={13}/></Link><Link href="/privacy">Privacy policy</Link><Link href="/data-deletion">Data deletion</Link></nav>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} RegCount</span><span>Know the name. Understand the count.</span><Link href="/how-it-works">Understand your data <ArrowUpRight size={13}/></Link></div>
  </footer>;
}
