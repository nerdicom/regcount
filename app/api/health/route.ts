export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', service: 'regcount', release: 'standalone-20260928' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
