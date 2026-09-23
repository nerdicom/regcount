import Link from 'next/link';
import { ArrowUpRight, BookOpen, Globe2, ListFilter } from 'lucide-react';
import { guides } from '@/lib/guides';

const visuals = [
  { icon: BookOpen, label: 'READ THE NUMBER', tokens: ['exact name', 'extensions', 'context'] },
  { icon: Globe2, label: 'KNOW YOUR EXTENSIONS', tokens: ['.com', '.co.uk', '.io'] },
  { icon: ListFilter, label: 'BUILD YOUR SHORTLIST', tokens: ['compare', 'inspect', 'export'] },
];

export function GuideCards({ heading = 'h3' }: { heading?: 'h2' | 'h3' }) {
  const Heading = heading;
  return <div className="guide-grid">{guides.map((guide, index) => {
    const visual = visuals[index];
    const Icon = visual.icon;
    return <Link key={guide.slug} className={`guide-card illustrated-guide guide-color-${index + 1}`} href={`/guides/${guide.slug}`}>
      <div className="guide-visual" aria-hidden="true"><div><Icon size={22}/><span>{visual.label}</span></div><div className="guide-tokens">{visual.tokens.map(token => <span key={token}>{token}</span>)}</div></div>
      <div className="guide-card-body"><span className="guide-meta">RESEARCH GUIDE · {guide.readingTime}</span><Heading>{guide.title}</Heading><p>{guide.description}</p><span className="guide-cta">Read the guide<ArrowUpRight size={16}/></span></div>
    </Link>;
  })}</div>;
}
