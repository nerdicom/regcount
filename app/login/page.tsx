import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '@/lib/seo';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
import { configuredProviders, getAuthSession, safeReturnUrl } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string; error?: string; mode?: string }> };

export async function generateMetadata({ searchParams }: LoginPageProps): Promise<Metadata> {
  const { mode } = await searchParams;
  return { title: mode === 'signup' ? 'Sign up' : 'Log in', robots: PRIVATE_ROBOTS };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeReturnUrl(params.callbackUrl, process.env.NEXTAUTH_URL || 'https://regcount.com');
  if (await getAuthSession()) redirect(callbackUrl);
  return <AuthShell><LoginForm providers={configuredProviders()} callbackUrl={callbackUrl} errorCode={params.error} isSignUp={params.mode === 'signup'}/></AuthShell>;
}
