import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { authReady, getAuthOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!authReady()) {
    const { nextauth } = await context.params;
    const readOnly = request.method === 'GET' && ['session', 'providers'].includes(nextauth[0]);
    return Response.json(readOnly ? {} : { error: 'Sign-in is not available yet.' }, {
      status: readOnly ? 200 : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return NextAuth(getAuthOptions())(request, context);
}

export { handler as GET, handler as POST };
