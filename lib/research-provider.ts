import { createHash } from 'node:crypto';
import { dataMode } from './registration-provider';
import { requestIndex, validateCoverage } from './czds-provider';
import { ProviderError } from './provider-error';
import { sampleMatches, type ResearchOptions, type ResearchMeta, type SearchResult, type DomainMatch } from './domains';
import { matchesResearchName, researchParams, parseResearchParams, PAGE_SIZE, MAX_PAGE } from '../infra/vps/search/query.mjs';

type Json=Record<string,unknown>;
const object=(value:unknown):value is Json=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const timestamp=(value:unknown):value is string=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const invalid=():never=>{throw new ProviderError('The index returned an unexpected advanced-search response.');};

export async function researchSearch(options:ResearchOptions):Promise<SearchResult> {
  const mode=dataMode(),exactName=options.q.replaceAll(' ','');
  if(mode==='demo') {
    const snapshot=createHash('sha256').update('regcount-research-demo-v1').digest('hex');
    if(options.snapshot&&options.snapshot!==snapshot)throw new ProviderError('Run the sample search again.',409);
    const rows=sampleMatches.filter(row=>matchesResearchName(row.name,options)).map(row=>({...row,suffixes:row.suffixes.filter(s=>!options.tlds.length||options.tlds.includes(s))})).filter(row=>row.suffixes.length).map(row=>({...row,count:row.suffixes.length}));
    const exact=rows.find(row=>row.name===exactName);
    const matches=rows.filter(row=>row.name!==exactName).sort((a,b)=>(options.sort==='name'?0:options.sort==='count_desc'?b.count-a.count:a.count-b.count)||a.name.localeCompare(b.name));
    const totalPages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
    return {query:options.q,exactName,position:options.position,source:'demo',total:exact?.count??null,suffixes:exact?.suffixes??[],related:matches.slice((options.page-1)*PAGE_SIZE,options.page*PAGE_SIZE),relatedPartial:matches.length>PAGE_SIZE,fetchedAt:null,
      message:'Illustrative sample collection only. These totals are not registration facts.',
      research:{version:2,options:{...options,snapshot},snapshot,page:options.page,pageSize:PAGE_SIZE,totalPages,keywordCount:rows.length,domainCount:rows.reduce((n,row)=>n+row.count,0),relatedTotal:matches.length,timedOut:false,hasNext:options.page<Math.min(totalPages,MAX_PAGE),exportScope:'page',pageLimit:MAX_PAGE}};
  }
  if(mode!=='czds')throw new ProviderError('Advanced search requires RegCount’s own domain index. Basic search is available.',503);
  const raw=await requestIndex(`/v2/search?${researchParams(options)}`);
  if(!object(raw)||raw.source!=='czds'||raw.query!==options.q||raw.exactName!==exactName||raw.position!==options.position||!integer(raw.total)||!Array.isArray(raw.related)||raw.related.length>PAGE_SIZE||typeof raw.relatedPartial!=='boolean'||!timestamp(raw.fetchedAt)||!object(raw.research))return invalid();
  const coverage=validateCoverage(raw.coverage),meta=raw.research;
  if(!object(meta.options)||typeof meta.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(meta.snapshot)||meta.version!==2||meta.page!==options.page||meta.pageSize!==PAGE_SIZE||meta.exportScope!=='page'||meta.pageLimit!==MAX_PAGE||typeof meta.hasNext!=='boolean'||typeof meta.timedOut!=='boolean')return invalid();
  let echoed:ResearchOptions;
  try{echoed=parseResearchParams(researchParams(meta.options as ResearchOptions));}catch{return invalid();}
  if(researchParams({...options,snapshot:meta.snapshot}).toString()!==researchParams(echoed).toString()||(options.snapshot&&options.snapshot!==meta.snapshot))return invalid();
  for(const key of ['totalPages','keywordCount','domainCount','relatedTotal'])if(meta[key]!==null&&!integer(meta[key]))return invalid();
  const totalsUnknown=meta.keywordCount===null;
  if(totalsUnknown!== (meta.domainCount===null) || totalsUnknown!==(meta.relatedTotal===null)||totalsUnknown!==(meta.totalPages===null))return invalid();
  function suffixes(value:unknown):string[] {
    if(!Array.isArray(value)||value.some(s=>typeof s!=='string'||!coverage.zones.some(z=>z.tld===s)||(options.tlds.length&&!options.tlds.includes(s)))||new Set(value).size!==value.length)return invalid();
    return value;
  }
  const list=suffixes(raw.suffixes);
  if(list.length!==raw.total || (list.length&&!matchesResearchName(exactName,options)))return invalid();
  const related:DomainMatch[]=raw.related.map(row=>{
    if(!object(row)||typeof row.name!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(row.name)||row.name===exactName||!matchesResearchName(row.name,options)||!integer(row.count))return invalid();
    const list=suffixes(row.suffixes);if(!list.length||list.length!==row.count)return invalid();
    return {name:row.name,count:row.count,suffixes:list};
  });
  if(new Set(related.map(row=>row.name)).size!==related.length)return invalid();
  if(totalsUnknown) {if(related.length||meta.hasNext||!raw.relatedPartial)return invalid();}
  else {
    const totalNames=meta.keywordCount as number,totalRelated=meta.relatedTotal as number;
    if(meta.timedOut||totalNames!==totalRelated+(raw.total>0?1:0)||(meta.domainCount as number)<raw.total+related.reduce((n,r)=>n+r.count,0)||meta.totalPages!==Math.max(1,Math.ceil(totalRelated/PAGE_SIZE))||meta.hasNext!==(options.page<Math.min(meta.totalPages as number,MAX_PAGE)))return invalid();
    if(related.length!==Math.min(PAGE_SIZE,Math.max(0,totalRelated-(options.page-1)*PAGE_SIZE)))return invalid();
    if(raw.relatedPartial!==(totalRelated>related.length))return invalid();
  }
  for(let i=1;i<related.length;i++) {
    const a=related[i-1],b=related[i],delta=options.sort==='name'?0:options.sort==='count_desc'?b.count-a.count:a.count-b.count;
    if(delta>0||(delta===0&&a.name>b.name))return invalid();
  }
  return {query:options.q,exactName,position:options.position,source:'czds',total:raw.total,suffixes:list,related,relatedPartial:raw.relatedPartial,
    ...(typeof raw.relatedMessage==='string'?{relatedMessage:raw.relatedMessage.slice(0,500)}:{}),coverage,fetchedAt:raw.fetchedAt,research:{...meta,options:echoed} as ResearchMeta};
}
