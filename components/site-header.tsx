import Image from 'next/image';
import Link from 'next/link';
import { AccountLink } from '@/components/account-controls';

export function SiteHeader({ active = '/' }: { active?: string }) {
  return <header className="site-header product-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="RegCount home"><Image src="/regcount-logo.png" alt="" width={56} height={56}/><span>Reg<span className="brand-count">Count</span><b>.</b></span></Link>
    <nav className="product-nav" aria-label="Main navigation">
      {[[ '/', 'Domain search'], ['/bulk-domain-search', 'Bulk search'], ['/guides', 'Guides'], ['/about', 'About']].map(([href, label]) => <Link key={href} href={href} aria-current={active === href || (href === '/guides' && active.startsWith('/guides/')) ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <AccountLink/>
  </div></header>;
}
