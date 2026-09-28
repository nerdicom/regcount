import { checkLiveExtensions } from '@/lib/live-dns';
import { dataMode, ProviderError } from '@/lib/registration-provider';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (dataMode() !== 'czds' || process.env.REGCOUNT_LIVE_DNS_ENABLED === 'false') {
    return Response.json({ error: 'Live DNS checks are not enabled.' }, { status: 503, headers });
  }
  try {
    const params = new URL(request.url).searchParams;
    if ((params.get('exclude')?.length ?? 0) > 500) throw Error('Too many excluded extensions.');
    return Response.json(await checkLiveExtensions(params.get('q') ?? '', (params.get('exclude') ?? '').split(',')), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Live checks are unavailable.' },
      { status: error instanceof ProviderError ? error.status : 400, headers });
  }
}
