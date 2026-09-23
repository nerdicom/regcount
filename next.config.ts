import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'www.regcount.com' }], destination: 'https://regcount.com/:path*', permanent: true }];
  },
  async headers() {
    return [
      ...['/api/:path*', '/login', '/account'].map(source => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] })),
      ...['/', '/bulk-domain-search'].map(source => ({ source, has: [{ type: 'query' as const, key: 'q' }], headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }] })),
    ];
  },
};
export default nextConfig;
