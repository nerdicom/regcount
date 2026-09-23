import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export async function GET() {
  const logo = await readFile(join(process.cwd(), 'public/regcount-logo.png'));
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '68px 78px', background: '#f4f7fe', color: '#18243d', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* The approved logo is embedded unchanged. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString('base64')}`} alt="" width={92} height={92}/>
        <span style={{ fontSize: 50, fontWeight: 700 }}>RegCount.</span>
      </div>
      <div style={{ display: 'flex', fontSize: 66, fontWeight: 700, lineHeight: 1.12, marginTop: 48, maxWidth: 1000 }}>One name. A world of extensions.</div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 28, color: '#63738e' }}>Domain registration research for domain people.</div>
      <div style={{ display: 'flex', marginTop: 'auto', gap: 18, fontSize: 24, color: '#0754f8' }}><span>regcount.com</span><span style={{ marginLeft: 'auto', color: '#00a88e' }}>.com</span><span style={{ color: '#e2941b' }}>.io</span><span style={{ color: '#8b5cf6' }}>.ai</span></div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
