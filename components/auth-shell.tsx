import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return <div className="auth-shell">
    <header className="auth-header">
      <Link className="brand" href="/" aria-label="RegCount home"><Image unoptimized src="/regcount-logo.png" alt="" width={56} height={56}/><span>Reg<span className="brand-count">Count</span><b>.</b></span></Link>
      <Link className="auth-back" href="/"><ArrowLeft size={16}/>Back to search</Link>
    </header>
    <main className="auth-layout">
      <section className="auth-story" aria-label="About RegCount">
        <div className="eyebrow"><span className="tiny-bars" aria-hidden="true"><i/><i/><i/></span>FOR DOMAIN PEOPLE</div>
        <h2>Great names.<br/>A world of possibilities.</h2>
        <p>Your next idea starts with a name. Explore its reach, compare the contenders, and see the bigger picture.</p>
        <div className="auth-domain-art" aria-hidden="true">
          <span className="auth-domain-name">your next idea<b>.</b></span>
          <div><span>.com</span><span>.io</span><span>.ai</span><span>.net</span><span>.co</span></div>
        </div>
        <span className="auth-story-note"><ShieldCheck size={17}/>A little clarity for your domain obsession.</span>
      </section>
      <section className="auth-card">{children}</section>
    </main>
    <footer className="auth-footer">RegCount · Domain registration intelligence</footer>
  </div>;
}
