import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Search, ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { SignOutButton } from '@/components/account-controls';
import { getAuthSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Your account — RegCount' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccount');
  const name = session.user.name || 'Domain explorer';
  return <AuthShell>
    <span className="auth-kicker">YOUR REGCOUNT ACCOUNT</span>
    <div className="account-large-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
    <h1>You’re in, {name.split(' ')[0]}.</h1>
    <p className="auth-intro">Let’s find your next great name.</p>
    <dl className="account-details">
      <div><dt>Name</dt><dd>{name}</dd></div>
      <div><dt>Email</dt><dd>{session.user.email || 'Not shared by your provider'}</dd></div>
      <div><dt>Signed in with</dt><dd><ShieldCheck size={15}/>{session.provider === 'facebook' ? 'Facebook' : session.provider === 'google' ? 'Google' : 'Connected account'}</dd></div>
    </dl>
    <Link className="primary-button account-search" href="/"><Search size={17}/>Search domains</Link>
    <SignOutButton/>
  </AuthShell>;
}
