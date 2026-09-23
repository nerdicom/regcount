'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';

function ProviderIcon({ provider }: { provider: 'google' | 'facebook' }) {
  return provider === 'facebook' ? <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877f2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z"/></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59A6 6 0 0 1 12 5.95Z"/></svg>;
}

const errors: Record<string, string> = {
  AccessDenied: 'Sign-in was cancelled or permission was declined. You can try again.',
  OAuthAccountNotLinked: 'Please sign in with the provider you used before.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again later.',
  OAuthSignin: 'We could not connect to that provider. Please try again.',
  OAuthCallback: 'We could not finish signing you in. Please try again.',
  SessionRequired: 'Please sign in to view your account.',
};

export function LoginForm({ providers, callbackUrl, errorCode }: {
  providers: { google: boolean; facebook: boolean }; callbackUrl: string; errorCode?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(errorCode ? (Object.hasOwn(errors, errorCode) ? errors[errorCode] : 'Sign-in could not be completed. Please try again.') : '');
  async function login(provider: 'google' | 'facebook') {
    setError(''); setBusy(provider);
    try { await signIn(provider, { callbackUrl }); }
    catch { setError('Could not connect. Check your connection and try again.'); setBusy(null); }
  }
  return <>
    <span className="auth-kicker">YOUR REGCOUNT ACCOUNT</span>
    <h1>Welcome, domain nerd.</h1>
    <p className="auth-intro">Sign in or get started with an account you already use.</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {!providers.google && !providers.facebook && <p className="auth-notice">Sign-in is coming soon. You can explore RegCount in the meantime.</p>}
    <div className="auth-provider-buttons">
      {(['google', 'facebook'] as const).map(provider => <button key={provider} className="auth-provider-button" disabled={!providers[provider] || Boolean(busy)} onClick={() => login(provider)}>
        {busy === provider ? <LoaderCircle size={20} className="spinning"/> : <ProviderIcon provider={provider}/>}
        <span>{busy === provider ? 'Connecting…' : `Continue with ${provider === 'google' ? 'Google' : 'Facebook'}`}</span>
        {!providers[provider] && <small>Soon</small>}
      </button>)}
    </div>
    <p className="auth-security"><LockKeyhole size={15}/>Your password stays with Google or Facebook.</p>
    <div className="auth-divider"/>
    <Link className="auth-guest" href="/">Explore without signing in<ArrowRight size={16}/></Link>
  </>;
}
