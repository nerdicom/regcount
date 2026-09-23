import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Let crawlers read HTML noindex rules on login and search-query pages.
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
