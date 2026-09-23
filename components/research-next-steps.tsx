import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Layers3, Rocket } from 'lucide-react';
import { DNLAUNCH_URL } from '@/lib/promotions';

export function ResearchNextSteps() {
  return <div className="research-next-steps">
    <div className="next-step"><span className="next-step-icon"><Layers3 size={20}/></span><div><Link href="/bulk-domain-search">Compare your shortlist <ArrowRight size={15}/></Link><p>Up to 50 names, side by side.</p></div></div>
    <div className="next-step"><span className="next-step-icon"><Rocket size={20}/></span><div><a href={DNLAUNCH_URL} target="_blank" rel="sponsored noopener noreferrer" referrerPolicy="no-referrer">Find a name on DNLaunch <ArrowUpRight size={15}/><span className="sr-only"> (opens in a new tab)</span></a><p>Browse domains for sale · Owner promotion</p></div></div>
  </div>;
}
