import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
    provider?: 'google' | 'facebook';
  }
}

declare module 'next-auth/jwt' {
  interface JWT { provider?: string }
}
