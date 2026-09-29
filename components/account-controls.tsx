'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ArrowUpRight, LoaderCircle, LogOut, UserRound } from 'lucide-react';

export function AccountLink() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <div className="account-actions" aria-busy="true"><span className="account-link account-loading" aria-label="Loading account"><LoaderCircle size={17} className="spinning"/></span></div>;
  return <div className="account-actions">
    {!session && <Link className="signup-link" href="/login?mode=signup">Sign up</Link>}
    <Link className="account-link" href={session ? '/account' : '/login'}>
      {session ? <span className="account-avatar" aria-hidden="true">{(session.user?.name || 'R').slice(0, 1).toUpperCase()}</span> : <UserRound size={17}/>}
      <span>{session ? 'My account' : 'Log in'}</span>
      {!session && <ArrowUpRight size={14}/>}
    </Link>
  </div>;
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try { await signOut({ callbackUrl: '/' }); }
    catch { setBusy(false); setError('Could not sign out. Please try again.'); }
  }
  return <div>
    <button className="auth-secondary" onClick={logout} disabled={busy}>
      {busy ? <LoaderCircle size={17} className="spinning"/> : <LogOut size={17}/>}
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>;
}
