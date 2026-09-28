import { researchSearch } from '@/lib/research-provider';
import { parseResearchParams } from '@/infra/vps/search/query.mjs';
import { ProviderError } from '@/lib/provider-error';
export async function GET(request:Request) {
  try { return Response.json(await researchSearch(parseResearchParams(new URL(request.url).searchParams)),{headers:{'Cache-Control':'private, no-store'}}); }
  catch(error) { return Response.json({error:error instanceof Error?error.message:'Search failed.'},{status:error instanceof ProviderError?error.status:400,headers:{'Cache-Control':'private, no-store'}}); }
}
