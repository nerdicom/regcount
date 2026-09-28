import { dataMode } from '@/lib/registration-provider';
import { readIndexStatus } from '@/lib/czds-provider';
export async function GET() {
  if(dataMode()!=='czds')return Response.json({error:'Coverage statistics are available when RegCount’s own index is connected.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  try {
    const status=await readIndexStatus();
    return Response.json({...status,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Coverage could not be loaded. Please try again.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
