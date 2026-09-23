// activeCount must come from explicit website-activity data, never from DNS or suffix counts.
export type DomainMatch = {name: string; count: number; activeCount?: number | null; suffixes: string[]};
export type SearchResult = {query: string; source: 'demo' | 'dotdb'; total: number | null; activeCount?: number | null; suffixes: string[]; related: DomainMatch[]; relatedPartial: boolean; fetchedAt: string | null; message?: string};
export type BulkRow = {query: string; total: number | null; source: 'demo' | 'dotdb'; suffixes: string[]; error?: string};
export const SAMPLE_NAMES = ['cypress', 'atlas', 'orbit', 'nova', 'outdoors', 'windmill'];
const common = 'com net org co io ai app dev tech xyz online site store info biz me us uk co.uk de fr ca au com.au nl ch it es eu in jp cn tv cc si cloud digital solutions group live world space agency studio design shop pro mobi news social network systems software team one'.split(' ');
const samples: Record<string,string[]> = {
 cypress: common.slice(0,48), atlas: [...common,...'ventures capital finance global travel earth life works center zone today wiki link club art games media services tools education academy support'.split(' ')],
 orbit: common.slice(0,42), nova: [...common,...'art media life works travel global ventures capital games club link'.split(' ')], outdoors: common.slice(0,24), windmill: common.slice(0,18),
};
export function normalizeQuery(value: string) {
 let input = value.trim().toLowerCase();
 if(!input) throw new Error('Enter a name or domain to search.');
 if(input.length>253) throw new Error('That name is too long.');
 if(/^https?:\/\//.test(input)){try{input=new URL(input).hostname;}catch{throw new Error('Enter a valid name or domain.');}}
 input=input.replace(/^www\./,'').replace(/\.$/,'');
 if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(input)) throw new Error('Use letters, numbers, and hyphens, without spaces.');
 const name=input.split('.')[0];
 if(name.length>63||name.startsWith('-')||name.endsWith('-')) throw new Error('Use 1–63 characters without a starting or ending hyphen.');
 return name;
}
export function extensionKind(suffix: string) {return suffix.split('.').at(-1)?.length===2?'country':'generic';}
export function demoResult(query: string): SearchResult {
 const list=samples[query];
 if(!list) return {query,source:'demo',total:null,suffixes:[],related:[],relatedPartial:false,fetchedAt:null,message:'This name is not in the sample collection. Try an example name below. Live registration data is not connected yet.'};
 const suffixes=[...new Set(list)];
 const related=[{name:`get${query}`,suffixes:common.slice(0,12)},{name:`${query}labs`,suffixes:common.slice(0,9)},{name:`my${query}`,suffixes:common.slice(0,7)},{name:`${query}group`,suffixes:common.slice(0,5)}].map(row=>({...row,count:row.suffixes.length}));
 return {query,source:'demo',total:suffixes.length,suffixes,related,relatedPartial:false,fetchedAt:null};
}
export function csvCell(value: string | number | null) {const s=String(value??''); const safe=/^[=+@\-\t\r]/.test(s)?`'${s}`:s; return `"${safe.replaceAll('"','""')}"`;}
