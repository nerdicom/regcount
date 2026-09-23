import Link from 'next/link';
import { ArrowUpRight, Code2 } from 'lucide-react';
import { configuredSponsor, NERDI_URL } from '@/lib/promotions';

export function SponsorSpot() {
  const sponsor = configuredSponsor(process.env);
  return <aside className="sponsor-spot" aria-label={sponsor ? 'Sponsored placement' : 'Nerdi owner promotion'} data-nosnippet>
    <div className="sponsor-mark" aria-hidden="true"><Code2 size={23}/></div>
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
