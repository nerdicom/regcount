import type { MetadataRoute } from 'next';
import { SITE_URL, PUBLIC_ROUTES, CONTENT_DATE } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(path => ({ url: `${SITE_URL}${path === '/' ? '' : path}`, lastModified: CONTENT_DATE }));
}
