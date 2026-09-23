import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '@/lib/seo';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
import { configuredProviders, getAuthSession, safeReturnUrl } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in', robots: PRIVATE_ROBOTS };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeReturnUrl(params.callbackUrl, process.env.NEXTAUTH_URL || 'https://regcount.com');
  if (await getAuthSession()) redirect(callbackUrl);
  return <AuthShell><LoginForm providers={configuredProviders()} callbackUrl={callbackUrl} errorCode={params.error}/></AuthShell>;
}
