import { ContentLayout } from '@/components/content-layout';
import { CoverageDashboard } from '@/components/coverage-dashboard';
import { pageMetadata } from '@/lib/seo';
export const metadata=pageMetadata('Domain data coverage','See which extensions are reporting, how many domain records are indexed, and when each source was last updated.','/coverage');
export default function CoveragePage(){return <ContentLayout title="Know what’s in the count." intro="Live coverage, snapshot freshness, and the extensions we still need to connect." label="DATA COVERAGE" breadcrumbs={[{name:'Coverage',path:'/coverage'}]}><CoverageDashboard/></ContentLayout>;}
