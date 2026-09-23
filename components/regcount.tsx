'use client';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { ResearchNextSteps } from '@/components/research-next-steps';
import { SearchResults } from '@/components/search-results';
import { CoverageNote } from '@/components/coverage-note';
import { useRouter } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowDown,ArrowDownUp,ArrowRight,ArrowUpRight,Check,Download,Globe2,Info,Layers3,ListTree,LoaderCircle,Search,ShieldCheck,X} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {Skeleton} from '@/components/ui/skeleton';
import {demoResult,normalizeQuery,parseSearchPosition,SEARCH_POSITIONS,SAMPLE_NAMES,csvCell,sourceLabel,type DataSource,type ZoneCoverage,type SearchPosition,type SearchResult,type BulkRow} from '@/lib/domains';

function downloadCsv(filename:string,rows:(string|number|null)[][]){const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type AgentTool={name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>Promise<unknown>};
export default function RegCount({initialView='search',initialSource='demo',promotion,children}:{initialView?:'search'|'bulk';initialSource?:DataSource;promotion?:React.ReactNode;children?:React.ReactNode}){
 const router=useRouter();
 const [view,setView]=useState(initialView),[input,setInput]=useState('cypress'),[result,setResult]=useState<SearchResult|null>(initialSource==='demo'?demoResult('cypress'):null);
 const [position,setPosition]=useState<SearchPosition>('any');
 const [loading,setLoading]=useState(initialSource!=='demo'&&initialView==='search'),[error,setError]=useState('');
 const [infoOpen,setInfoOpen]=useState(false);
 const [bulkInput,setBulkInput]=useState(''),[bulkRows,setBulkRows]=useState<BulkRow[]|null>(null),[bulkLoading,setBulkLoading]=useState(false),[bulkError,setBulkError]=useState(''),[sortDesc,setSortDesc]=useState(true);
 const [source,setSource]=useState<DataSource>(initialSource);
 const [bulkCoverage,setBulkCoverage]=useState<ZoneCoverage|undefined>();
 const inputRef=useRef<HTMLInputElement>(null),requestRef=useRef<AbortController|null>(null),bulkRef=useRef<AbortController|null>(null);
 const search=useCallback(async(term:string,requestedPosition:SearchPosition='any',updateUrl=true)=>{
  const query=normalizeQuery(term);requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;
  setInput(query);setPosition(requestedPosition);setLoading(true);setError('');
  try{const params=new URLSearchParams({q:query,position:requestedPosition});const response=await fetch(`/api/search?${params}`,{signal:controller.signal});const data=await response.json() as SearchResult & {error?:string};if(!response.ok)throw new Error(data.error||'Search could not be completed. Please try again.');if(controller.signal.aborted)return null;setResult(data);setSource(data.source);if(updateUrl){const url=new URL(window.location.href);url.searchParams.set('q',query);if(requestedPosition==='any')url.searchParams.delete('position');else url.searchParams.set('position',requestedPosition);window.history.replaceState({},'',url);}return data as SearchResult;}
  catch(err){if(controller.signal.aborted)return null;setError(err instanceof Error?err.message:'Something went wrong. Please try again.');return null;}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 const runBulk=useCallback(async(value:string)=>{
  const queries=value.split(/[\s,;]+/).filter(Boolean);if(!queries.length)throw new Error('Add at least one name to compare.');if(queries.length>50)throw new Error('Compare up to 50 names at a time.');
  bulkRef.current?.abort();const controller=new AbortController();bulkRef.current=controller;setBulkLoading(true);setBulkError('');
  try{const response=await fetch('/api/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries}),signal:controller.signal});const data=await response.json() as {source:DataSource;results:BulkRow[];coverage?:ZoneCoverage;error?:string};if(!response.ok)throw new Error(data.error||'The comparison could not be completed.');if(controller.signal.aborted)return null;setBulkRows(data.results);setBulkCoverage(data.coverage);setSource(data.source);return data;}
  catch(err){if(controller.signal.aborted)return null;setBulkError(err instanceof Error?err.message:'Something went wrong.');return null;}
  finally{if(!controller.signal.aborted)setBulkLoading(false);}
 },[]);
 useEffect(()=>{
  let mounted=true;
  // Defer initialization so cleanup can cancel it during React's development remount.
  Promise.resolve().then(()=>{if(mounted&&initialView==='search'){const params=new URLSearchParams(window.location.search);return search(params.get('q')||'cypress',parseSearchPosition(params.get('position')),false);}}).catch(err=>{if(mounted)setError(err.message);});
  function shortcut(e:KeyboardEvent){if(e.key==='/'&&!['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)&&!(e.target as HTMLElement)?.isContentEditable){e.preventDefault();if(initialView==='bulk'){router.push('/');return;}setView('search');setTimeout(()=>inputRef.current?.focus(),0);}}
  window.addEventListener('keydown',shortcut);return()=>{mounted=false;window.removeEventListener('keydown',shortcut);requestRef.current?.abort();bulkRef.current?.abort();};
 },[search,initialView,router]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:AgentTool,options:{signal:AbortSignal})=>unknown}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
  const register=(tool:AgentTool)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'search_domain_registrations',title:'Search domain registrations',description:'Search and display exact-name extensions plus related names with the keyword in any position, at the beginning, or at the end. source=demo means illustrative samples, not verified registrations.',inputSchema:{type:'object',properties:{query:{type:'string'},position:{type:'string',enum:['any','beginning','end'],default:'any'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async value=>{if(!value||typeof value!=='object'||typeof(value as {query?:unknown}).query!=='string')throw new Error('query must be a string');const query=normalizeQuery((value as {query:string}).query);const matchPosition=parseSearchPosition((value as {position?:unknown}).position);setView('search');const data=await search(query,matchPosition);if(!data)throw new Error('Search failed');await new Promise(resolve=>requestAnimationFrame(resolve));return {query:data.query,position:data.position,source:data.source,total:data.total,suffixes:data.suffixes,related:data.related,relatedPartial:data.relatedPartial,message:data.message,coverage:data.coverage,relatedMessage:data.relatedMessage};}});
  register({name:'compare_domain_registrations',title:'Compare domain registrations',description:'Compare and display up to 50 names. Sample results are labeled demo and are not verified registration facts.',inputSchema:{type:'object',properties:{queries:{type:'array',items:{type:'string'},minItems:1,maxItems:50}},required:['queries'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async value=>{const queries=(value as {queries?:unknown})?.queries;if(!Array.isArray(queries)||!queries.length||queries.length>50||queries.some(q=>typeof q!=='string'))throw new Error('queries must contain 1–50 strings');const text=queries.join('\n');setView('bulk');setBulkInput(text);const data=await runBulk(text);if(!data)throw new Error('Comparison failed');await new Promise(resolve=>requestAnimationFrame(resolve));return data;}});
  return()=>lifecycle.abort();
 },[runBulk,search]);
 function submit(e:FormEvent){e.preventDefault();search(input,position).catch(err=>setError(err.message));}
 function changePosition(next:SearchPosition){setPosition(next);search(input,next).catch(err=>setError(err.message));}
 function selectName(name:string){if(initialView==='bulk'){router.push(`/?${new URLSearchParams({q:name,position})}`);return;}setView('search');search(name,position).catch(err=>setError(err.message));}
 const sorted=[...(bulkRows||[])].sort((a,b)=>a.total===null?(b.total===null?0:1):b.total===null?-1:(sortDesc?-1:1)*(a.total-b.total));
 const bulkCount=bulkInput.split(/[\s,;]+/).filter(Boolean).length;
 return <div className="site-shell research-shell">
 <a href="#main" className="skip-link">Skip to search</a>
 <SiteHeader active={initialView==='search'?'/':'/bulk-domain-search'}/>
 <div className="preview-strip"><div><span className="preview-label">{source==='demo'?'PREVIEW':'DATA'}</span><span>{source==='demo'?'Explore sample data. Live registration data isn’t connected yet.':source==='czds'?'Real domain data from CZDS zone snapshots. Coverage and update times are shown with results.':'Registration data by dotDB. Counts reflect the provider’s index.'}</span><button onClick={()=>setInfoOpen(true)}>Learn more <ArrowUpRight size={14}/></button></div></div>
 <main id="main" className="workspace">
 {view==='search'&&<section aria-label="Domain search">
  <div className="search-hero"><div className="page-intro"><div className="eyebrow"><span className="tiny-bars" aria-hidden="true"><i/><i/><i/></span>DOMAIN REGISTRATION RESEARCH</div><h1>One name. <span>The bigger picture.</span></h1><p>Explore its reach. Compare extensions. Find your next great name.</p><div className="hero-benefits"><span><Check size={15}/>Exact-name search</span><span><Check size={15}/>Bulk comparison</span><span><Check size={15}/>CSV exports</span></div></div><Link className="hero-bulk-link" href="/bulk-domain-search"><Layers3 size={18}/><span>Have a shortlist?<strong>Compare names in bulk <ArrowRight size={14}/></strong></span></Link></div>

  <form id="domain-search-form" className="search-form" onSubmit={submit}><Search className="search-icon" size={23}/><label className="sr-only" htmlFor="domain-search">Name or domain</label><input id="domain-search" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter a name or domain" autoComplete="off" spellCheck={false} maxLength={253}/><kbd aria-hidden="true">/</kbd><button className="primary-button search-button" disabled={loading} type="submit" aria-label="Count registrations">{loading?<LoaderCircle className="spinning" size={18}/>:<Search size={18}/>}<span>{loading?'Searching':'Count registrations'}</span></button></form>
  <div className="search-match-options">
   <fieldset className="search-position" aria-describedby="search-position-hint"><legend className="sr-only">Keyword position</legend>{SEARCH_POSITIONS.map(option=><label key={option.value} className={position===option.value?'selected':''}><input type="radio" name="position" form="domain-search-form" value={option.value} checked={position===option.value} onChange={()=>changePosition(option.value)}/><span>{option.label}</span></label>)}</fieldset>
   <p id="search-position-hint">{SEARCH_POSITIONS.find(option=>option.value===position)?.description}</p>
  </div>
  <div className="sample-picks"><span>{source==='demo'?'Try a sample:':'Try a name:'}</span>{['cypress','atlas','orbit','nova'].map(name=><button key={name} onClick={()=>selectName(name)}>{name}<ArrowUpRight size={12}/></button>)}<span className="search-hint">Exact names. Clear numbers.</span></div>
  {error&&<div className="error-message" role="alert"><Info size={18}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
  {promotion}
  <div className="research-layout research-layout-wide" data-nosnippet>
   <section className="results-panel" aria-label="Search results" aria-busy={loading}>
   {loading?<div className="loading-results" aria-live="polite"><LoaderCircle className="spinning"/><p>Looking up {input}…</p><Skeleton className="h-24 w-full"/><div className="skeleton-grid">{Array.from({length:12},(_,i)=><Skeleton key={i} className="h-16"/>)}</div></div>:!result?<div className="empty-results"><h2>Search is temporarily unavailable</h2><p>Try your search again shortly. No sample counts are substituted for missing data.</p></div>:result.total===null&&!result.related.length?<div className="empty-results"><div className="empty-symbol"><Search size={28}/></div><span className="sample-badge">SAMPLE COLLECTION</span><h2>No sample for “{result.query}”</h2><p>{result.message}</p><button className="primary-button" onClick={()=>selectName('cypress')}>Explore cypress <ArrowRight size={17}/></button></div>:<SearchResults key={`${result.source}-${result.query}-${result.position}-${result.fetchedAt}`} result={result} onSelectName={selectName}/>}
   </section>
   <ResearchNextSteps/>
  </div>
 </section>}
 {view==='bulk'&&<section aria-label="Bulk domain search">
  <div className="page-intro bulk-intro"><div className="eyebrow"><Layers3 size={16}/>BULK RESEARCH</div><h1>Bulk domain search.<br/><span>One clear comparison.</span></h1><p>Compare exact-match extension counts for up to 50 names at once.</p></div>
  {promotion}
  <div className="bulk-layout"><section className="bulk-input-panel"><div className="panel-title"><h2>Your names</h2><button onClick={()=>setBulkInput(SAMPLE_NAMES.join('\n'))}>{source==='demo'?'Load sample list':'Load example names'}</button></div><label htmlFor="bulk-names">One name or domain per line</label><textarea id="bulk-names" value={bulkInput} onChange={e=>setBulkInput(e.target.value)} placeholder={'cypress\natlas.com\norbit.io'} spellCheck={false} maxLength={13000}/><div className="bulk-input-meta"><span>{bulkCount} / 50 names</span><button onClick={()=>{setBulkInput('');setBulkRows(null);setBulkCoverage(undefined);setBulkError('');}} disabled={bulkLoading}>Clear</button></div><button className="primary-button bulk-submit" disabled={bulkLoading} onClick={()=>runBulk(bulkInput).catch(err=>setBulkError(err.message))}>{bulkLoading?<LoaderCircle className="spinning" size={18}/>:<Layers3 size={18}/>} {bulkLoading?'Comparing names…':'Compare registrations'}</button><p className="input-footnote">Duplicates are combined. Extensions are removed to compare the underlying names.</p></section>
   <section className="bulk-results-panel" aria-busy={bulkLoading} data-nosnippet><div className="panel-title"><h2>Comparison</h2>{bulkRows&&<button onClick={()=>downloadCsv(`regcount-comparison-${source}.csv`,[['Name','Extension count','Data source','Note','Covered extensions','Snapshot download times'],...sorted.map(row=>[row.query,row.total,sourceLabel(row.source),row.error||'',row.coverage?.zones.map(z=>'.'+z.tld).join(' ')||'',row.coverage?.zones.map(z=>'.'+z.tld+' '+z.downloadedAt).join('; ')||''])])}><Download size={16}/>Download CSV</button>}</div>
    {bulkCoverage&&<CoverageNote coverage={bulkCoverage}/>}
    {bulkError&&<div className="error-message" role="alert"><Info size={18}/>{bulkError}</div>}
    {bulkLoading?<div className="bulk-empty"><LoaderCircle className="spinning" size={28}/><h3>Counting across your list…</h3><p>Comparing names and collecting their extension counts.</p></div>:!bulkRows?<div className="bulk-empty"><div className="empty-symbol"><ListTree size={32}/></div><h3>Big picture. Side by side.</h3><p>Add your names to see which ones have the broadest reach across extensions.</p><button onClick={()=>{const text=SAMPLE_NAMES.join('\n');setBulkInput(text);runBulk(text).catch(err=>setBulkError(err.message));}}>{source==='demo'?'Try a sample comparison':'Compare example names'} <ArrowRight size={16}/></button></div>:<><Table className="bulk-table"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Name</TableHead><TableHead><button onClick={()=>setSortDesc(!sortDesc)}>Extensions {sortDesc?<ArrowDown size={14}/>:<ArrowDownUp size={14}/>}</button></TableHead><TableHead>Data</TableHead></TableRow></TableHeader><TableBody>{sorted.map((row,index)=><TableRow key={row.query}><TableCell className="rank">{index+1}</TableCell><TableCell><button className="domain-button" onClick={()=>selectName(row.query)}>{row.query}<ArrowUpRight size={13}/></button>{row.error&&<small className="row-error">{row.error}</small>}</TableCell><TableCell><span className="bulk-count">{row.total===null?'—':row.total}</span>{row.total!==null&&<span className="mini-bar" style={{width:`${Math.max(4,(row.total/Math.max(...sorted.map(r=>r.total||0),1))*64)}px`}}/>}</TableCell><TableCell><span className="sample-badge">{row.source==='demo'?'SAMPLE':row.source==='czds'?'CZDS':'DOTDB'}</span></TableCell></TableRow>)}</TableBody></Table><div className="results-bottom"><span>{bulkRows.length} unique names · {source==='demo'?'Illustrative data only':source==='czds'?'Delegated domains in covered zones':'Provider-indexed registrations'}</span></div></>}
   </section>
  </div>
 </section>}
 <div className="data-note"><ShieldCheck size={17}/><p>{source==='demo'?'Sample counts demonstrate the product. They are not registration or availability checks.':'Counts reflect the provider’s index. A missing extension does not mean a domain is available.'}</p><button onClick={()=>setInfoOpen(true)}>How counts work <ArrowUpRight size={14}/></button></div>
 {children}
 </main>
 <SiteFooter/>
 <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="data-dialog"><DialogHeader><div className="dialog-mark"><Globe2 size={25}/></div><DialogTitle>Know what you’re counting.</DialogTitle><DialogDescription>RegCount measures the number of distinct extensions found for an exact name in its data source.</DialogDescription></DialogHeader><div className="dialog-copy"><h3>{source==='demo'?'You’re viewing sample data':source==='czds'?'CZDS domain snapshots':'Registration data by dotDB'}</h3><p>{source==='demo'?'These names, counts, and extension lists are illustrative. Explore search, filtering, bulk comparison, and exports. The examples have not been checked against actual registrations.':source==='czds'?'Searches use the imported DNS zones listed with each result. Counts describe delegated domains in those zones. Some registered domains are absent from zone files. Missing priority extensions remain unknown.':'Searches use dotDB’s index. Results can lag new registrations and depend on the extensions and domains covered by the provider.'}</p><h3>Exact matches, not related words</h3><p>A search for “cypress” counts cypress.com and cypress.net separately. getcypress.com belongs in related results and does not increase the exact-match count.</p><h3>Coverage has limits</h3><p>DNS visibility, country-code coverage, and update timing affect counts. This is not a live availability check. Country codes include .ai, .io, and .co.</p><h3>Multi-part extensions</h3><p>Suffixes are displayed as supplied by the source. For example, .uk and .co.uk may count separately.</p></div></DialogContent></Dialog>
 </div>;
}
