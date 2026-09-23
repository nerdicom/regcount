import type { Metadata } from 'next';

export const SITE_URL = 'https://regcount.com';
export const SITE_NAME = 'RegCount';
export const CONTENT_DATE = '2026-09-23';
export const SOCIAL_IMAGE = { url: `${SITE_URL}/social-image`, width: 1200, height: 630, alt: 'RegCount — Domain registration research for domain people' };
export const PUBLIC_ROUTES = ['/', '/bulk-domain-search', '/how-it-works', '/about', '/glossary', '/guides', '/guides/domain-registration-count', '/guides/domain-extensions-explained', '/guides/compare-domain-names'];
export const PRIVATE_ROBOTS = { index: false, follow: false };
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  const fullTitle = `${title} | RegCount`;
  return {
    title: { absolute: fullTitle }, description,
    alternates: { canonical: `${SITE_URL}${path === '/' ? '' : path}` },
    robots: { index, follow: true, googleBot: { index, follow: true, 'max-image-preview': 'large' } },
    openGraph: { type: 'website', locale: 'en_US', siteName: SITE_NAME, title: fullTitle, description, url: `${SITE_URL}${path}`, images: [SOCIAL_IMAGE] },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [SOCIAL_IMAGE.url] },
  };
}

export function breadcrumbData(items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: `${SITE_URL}${item.path}` })) };
}
