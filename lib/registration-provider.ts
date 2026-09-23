import {env} from 'cloudflare:workers';
import {demoResult,normalizeQuery,type SearchResult,type DomainMatch} from './domains';

type Settings={REGCOUNT_LIVE_ENABLED?:string;DOTDB_API_KEY?:string};
export class ProviderError extends Error{constructor(message:string,public status=502){super(message);}}
export function dataMode(): 'dotdb' | 'demo' {const settings=env as unknown as Settings;return settings.REGCOUNT_LIVE_ENABLED==='true'?'dotdb':'demo';}
const cache=new Map<string,{expires:number;value:SearchResult}>();
function cleanSuffixes(value:unknown):string[]{if(!Array.isArray(value))return[];return [...new Set(value.filter((x):x is string=>typeof x==='string').map(s=>s.replace(/^\./,'').toLowerCase()).filter(s=>/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(s)))];}
function numeric(value:unknown):number|null{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;}
async function queryProvider(query:string,key:string,exact=false){
 const url=new URL('https://api.dotdb.com/v2/search');url.searchParams.set('keyword',query);if(exact){url.searchParams.set('min_length',String(query.length));url.searchParams.set('max_length',String(query.length));}
 let response:Response;try{response=await fetch(url,{headers:{Authorization:`Token ${key}`},signal:AbortSignal.timeout(12000)});}catch{throw new ProviderError('The registration provider did not respond. Please try again.');}
 if(response.status===429)throw new ProviderError('The registration provider’s search limit was reached. Please try again later.',429);
 if(response.status===401||response.status===403)throw new ProviderError('Live data access is not configured correctly. Please contact the site owner.',503);
 if(!response.ok)throw new ProviderError('The registration provider is temporarily unavailable. Please try again.');
 let payload;try{payload=await response.json() as Record<string,unknown>;}catch{throw new ProviderError('The registration provider returned an unreadable response.');}
 if(!payload||!Array.isArray(payload.matches)||numeric(payload.exact_match_total_suffix)===null)throw new ProviderError('The registration provider returned an unexpected response.');
 return payload;
}
export async function searchRegistrations(value:string):Promise<SearchResult>{
 const query=normalizeQuery(value),mode=dataMode();if(mode==='demo')return demoResult(query);
 const key=(env as unknown as Settings).DOTDB_API_KEY;if(!key)throw new ProviderError('Live registration data has not been connected yet.',503);
 const cached=cache.get(query);if(cached&&cached.expires>Date.now())return cached.value;
 const payload=await queryProvider(query,key);
 const parse=(rows:unknown)=>Array.isArray(rows)?rows.filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object'&&typeof row.name==='string'&&/^[a-z0-9-]{1,63}$/.test(row.name)).map(row=>({name:String(row.name),count:numeric(row.count)??cleanSuffixes(row.suffixes).length,suffixes:cleanSuffixes(row.suffixes)})):[];
 const matches:DomainMatch[]=parse(payload.matches);let exact=matches.find(row=>row.name===query);
 const total=numeric(payload.exact_match_total_suffix)!;
 if(total>0&&!exact){const exactPayload=await queryProvider(query,key,true);exact=parse(exactPayload.matches).find(row=>row.name===query);}
 if(total>0&&!exact)throw new ProviderError('The provider returned a count without the matching extension list. Please try again.');
 const result:SearchResult={query,source:'dotdb',total,suffixes:exact?.suffixes||[],related:matches.filter(row=>row.name!==query),relatedPartial:Number(payload.total_name)>matches.length,fetchedAt:new Date().toISOString()};
 if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(query,{expires:Date.now()+5*60*1000,value:result});return result;
}
