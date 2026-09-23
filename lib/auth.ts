import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

export function authReady() {
  // Never generate a temporary production secret: sessions must survive redeploys.
  if ((process.env.NEXTAUTH_SECRET?.trim().length ?? 0) < 32) return false;
  try {
    const url = new URL(process.env.NEXTAUTH_URL || '');
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch { return false; }
}

export function configuredProviders() {
  const ready = authReady();
  return {
    google: ready && Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    facebook: ready && Boolean(process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim()),
  };
}

export function safeReturnUrl(value: string | undefined, origin: string) {
  try {
    const base = new URL(origin);
    const target = new URL(value || '/account', base);
    if (target.origin === base.origin && !target.username && !target.password && !target.pathname.startsWith('//') &&
        !/^\/(?:api\/auth|login)(?:\/|$)/.test(target.pathname)) {
      return target.pathname + target.search + target.hash;
    }
  } catch { /* Untrusted callback URLs always return to the account page. */ }
  return '/account';
}

export function getAuthOptions(): NextAuthOptions {
  const enabled = configuredProviders();
  const providers: NextAuthOptions['providers'] = [];
  if (enabled.google) providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
  }));
  if (enabled.facebook) providers.push(FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    // Override the library's legacy v11 authorization URL.
    authorization: { url: 'https://www.facebook.com/v25.0/dialog/oauth', params: { scope: 'email,public_profile' } },
    token: 'https://graph.facebook.com/v25.0/oauth/access_token',
    userinfo: { url: 'https://graph.facebook.com/v25.0/me', params: { fields: 'id,name,email' } },
    checks: ['state'],
    profile(profile) {
      return { id: profile.id, name: profile.name, email: profile.email ?? null, image: null };
    },
  }));
  return {
    providers,
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
    pages: { signIn: '/login', error: '/login' },
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          // Provider identities stay distinct, even when their emails match.
          token.sub = `${account.provider}:${account.providerAccountId}`;
          token.provider = account.provider;
          delete token.picture;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub || '';
          delete session.user.image;
        }
        session.provider = token.provider === 'google' || token.provider === 'facebook' ? token.provider : undefined;
        return session;
      },
      async redirect({ url, baseUrl }) {
        return new URL(safeReturnUrl(url, baseUrl), baseUrl).href;
      },
    },
    // Log only the error code, never tokens or provider response payloads.
    logger: { error(code) { console.error('[auth]', code); } },
  };
}

export async function getAuthSession() {
  return authReady() ? getServerSession(getAuthOptions()) : null;
}
