import type { Metadata } from 'next';
import './globals.css';
import './research.css';
import { AuthProvider } from '@/components/auth-provider';
import { SITE_URL, SOCIAL_IMAGE } from '@/lib/seo';
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Domain Registration Count & Extension Search | RegCount', template: '%s | RegCount' },
  description: 'Explore domain registration counts, compare names across extensions, and learn a practical domain research workflow. Try the clearly labeled RegCount preview.',
  applicationName: 'RegCount',
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: 'RegCount', locale: 'en_US', images: [SOCIAL_IMAGE] },
  twitter: { card: 'summary_large_image', images: [SOCIAL_IMAGE.url] },
  icons: { icon: '/regcount-logo.png', shortcut: '/regcount-logo.png', apple: '/regcount-logo.png' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
