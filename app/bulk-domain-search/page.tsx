import { SponsorSpot } from '@/components/sponsor-spot';
import RegCount from '@/components/regcount';
import { SearchContent } from '@/components/search-content';
import { StructuredData } from '@/components/structured-data';
import { breadcrumbData, pageMetadata, type SearchParams } from '@/lib/seo';
import { dataMode } from '@/lib/registration-provider';

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return pageMetadata('Bulk Domain Search & Extension Count Comparison', 'Compare up to 50 names by exact-match extension count, combine duplicates, and export CSV results. Explore RegCount’s labeled sample-data preview.', '/bulk-domain-search', !('q' in params));
}
export default function BulkSearchPage() {
  return <><RegCount initialSource={dataMode()} initialView="bulk" promotion={<SponsorSpot/>}><SearchContent bulk/></RegCount><StructuredData value={breadcrumbData([{ name: 'Home', path: '/' }, { name: 'Bulk domain search', path: '/bulk-domain-search' }])}/></>;
}
