import { SponsorSpot } from '@/components/sponsor-spot';
import RegCount from '@/components/regcount';
import { SearchContent } from '@/components/search-content';
import { StructuredData } from '@/components/structured-data';
import { pageMetadata, SITE_URL, type SearchParams } from '@/lib/seo';

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return pageMetadata('Domain Registration Count & Extension Search', 'Explore domain registration counts and exact-name extension lists. Compare names, export results, and try RegCount’s clearly labeled sample-data preview.', '/', !('q' in params || 'position' in params));
}
export default function Home() {
  return <>
    <RegCount promotion={<SponsorSpot/>}><SearchContent/></RegCount>
    <StructuredData value={{ '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'RegCount', url: SITE_URL, logo: `${SITE_URL}/regcount-logo.png` },
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'RegCount', url: SITE_URL, publisher: { '@id': `${SITE_URL}/#organization` }, inLanguage: 'en' },
      { '@type': 'WebApplication', name: 'RegCount', url: SITE_URL, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: 'A domain registration research tool with exact-name extension search, bulk comparison, and CSV exports. The preview uses explicitly labeled sample data.' },
    ] }}/>
  </>;
}
