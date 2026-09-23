import Link from 'next/link';
import { ArrowUpRight, Check, Mail, MousePointer2, PanelTop, Users } from 'lucide-react';
import { ContentLayout } from '@/components/content-layout';
import { ADVERTISING_EMAIL, ADVERTISING_MAILTO } from '@/lib/promotions';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Advertise with RegCount', 'Introduce your domain, hosting, or website product to people researching names. Ask RegCount about a clearly labeled sponsored placement, pricing, and available dates.', '/advertise');

export default function AdvertisePage() {
  return <ContentLayout label="WORK WITH REGCOUNT" title="Meet people thinking about their next name." intro="A focused placement for domain services, website tools, and products that help an idea become a business." breadcrumbs={[{ name: 'Advertise', path: '/advertise' }]}>
    <div className="advertise-layout">
      <section className="advertise-offer" aria-labelledby="placement-title">
        <span className="advertise-kicker"><PanelTop size={18}/>SEARCH SPONSORSHIP</span>
        <h2 id="placement-title">One useful message.<br/>Right beside the research.</h2>
        <p>Your brand, a short introduction, and a direct link appear above the results on domain search and bulk search.</p>
        <ul><li><Check size={17}/>One clearly labeled sponsor per page</li><li><Check size={17}/>A text placement that works on desktop and phone</li><li><Check size={17}/>Your approved destination and campaign link</li><li><Check size={17}/>Dates, copy, and price agreed before anything runs</li></ul>
        <div className="placement-example" aria-label="Illustration of a sponsored placement"><span>SPONSORED · YOUR BRAND</span><strong>A useful next step for a domain researcher.</strong><p>Your message and a link to learn more.</p></div>
      </section>
      <aside className="advertise-contact">
        <span className="eyebrow">LET’S TALK</span><h2>Ask about a placement.</h2><p>Tell us what you offer, your preferred dates, and a budget range. We’ll discuss availability and a price before you commit.</p>
        <a className="primary-button" href={ADVERTISING_MAILTO}><Mail size={17}/>Email about advertising<ArrowUpRight size={16}/></a>
        <p className="contact-caption">Opens a draft in your email app. Nothing is sent until you send it.</p>
        <a className="advertise-email" href={`mailto:${ADVERTISING_EMAIL}`}>{ADVERTISING_EMAIL}</a>
        <p className="contact-caption">Using webmail? Copy the address above and include your business, website, dates, and budget.</p>
      </aside>
    </div>
    <section className="advertise-principles" aria-label="How sponsorship works">
      <div><Users size={21}/><h2>A relevant context.</h2><p>RegCount is built for people comparing names and extensions. Ask us for the audience information currently available; we don’t promise traffic, clicks, or sales.</p></div>
      <div><MousePointer2 size={21}/><h2>A clear next step.</h2><p>Visitors choose whether to follow your link. Campaign tags can identify referrals in your own analytics. We don’t share account details or search terms with sponsors.</p></div>
      <div><Check size={21}/><h2>Research stays independent.</h2><p>Sponsored placements do not change search counts, rankings, or coverage labels. Search, bulk comparison, and exports remain free to use.</p></div>
    </section>
    <div className="advertise-disclosure"><h2>About our own promotions</h2><p>RegCount, Nerdi, and DNLaunch share an owner. We may promote Nerdi’s website services or DNLaunch’s domain marketplace in spaces marked “Owner promotion.” Those businesses benefit when you become a customer. A sponsored link may also pay for placement or generate a referral commission, as disclosed beside the link.</p><Link href="/privacy">Read our privacy policy <ArrowUpRight size={14}/></Link></div>
  </ContentLayout>;
}
