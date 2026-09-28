import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Code2 } from 'lucide-react';
import { configuredSponsor, NERDI_URL } from '@/lib/promotions';

export function SponsorSpot() {
  const sponsor = configuredSponsor(process.env);
  return <aside className={`sponsor-spot${sponsor ? '' : ' sponsor-spot-nerdi'}`} aria-label={sponsor ? 'Sponsored placement' : 'Nerdi owner promotion'} data-nosnippet>
    {sponsor ? <div className="sponsor-mark" aria-hidden="true"><Code2 size={23}/></div> : <a className="sponsor-logo" href={NERDI_URL} target="_blank" rel="sponsored noopener noreferrer" referrerPolicy="no-referrer">
      <Image src="/nerdi-logo.webp" alt="Nerdi" width={80} height={80} sizes="(max-width: 640px) 64px, 80px"/>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>}
    <div className="sponsor-message">
      <span className="promotion-label">{sponsor ? `SPONSORED · ${sponsor.name}` : 'NERDI · OWNER PROMOTION'}</span>
      <h2>{sponsor?.headline ?? 'Your next name. Your next website.'}</h2>
      <p>{sponsor?.description ?? 'Custom website design & build. $500 one-time fee.'}</p>
      <small>{sponsor ? 'RegCount may be paid for this placement or earn a commission.' : 'Domain, hosting, paid services, and integrations are separate.'}</small>
    </div>
    <div className="sponsor-actions">
      <a className="sponsor-cta" href={sponsor?.url ?? NERDI_URL} target="_blank" rel="sponsored noopener noreferrer" referrerPolicy="no-referrer">{sponsor?.cta ?? 'Explore Nerdi'}<ArrowUpRight size={15}/><span className="sr-only"> (opens in a new tab)</span></a>
      <Link href="/advertise">Advertise here</Link>
    </div>
  </aside>;
}
