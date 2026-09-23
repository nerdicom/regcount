import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
export const metadata: Metadata = {
  title: 'RegCount — Domain registration intelligence',
  description: 'Explore exact-match domain extensions, count registrations, and compare names with RegCount.',
  robots: { index: false, follow: false },
  icons: { icon: '/regcount-logo.png', shortcut: '/regcount-logo.png' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
