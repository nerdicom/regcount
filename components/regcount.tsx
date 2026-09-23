'use client';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { NameIllustration } from '@/components/name-illustration';
import { SearchResults } from '@/components/search-results';
import { useRouter } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowDown,ArrowDownUp,ArrowRight,ArrowUpRight,Check,ChevronRight,Download,Globe2,Info,Layers3,ListTree,LoaderCircle,Search,ShieldCheck,Sparkles,X} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {Skeleton} from '@/components/ui/skeleton';
import {demoResult,normalizeQuery,SAMPLE_NAMES,csvCell,type SearchResult,type BulkRow} from '@/lib/domains';

function downloadCsv(filename:string,rows:(string|number|null)[][]){const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type AgentTool={name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>Promise<unknown>};
export default function RegCount({initialView='search',children}:{initialView?:'search'|'bulk';children?:React.ReactNode}){
 const router=useRouter();
 const [view,setView]=useState(initialView),[input,setInput]=useState('cypress'),[result,setResult]=useState<SearchResult>(demoResult('cypress'));
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [infoOpen,setInfoOpen]=useState(false);
 const [bulkInput,setBulkInput]=useState(''),[bulkRows,setBulkRows]=useState<BulkRow[]|null>(null),[bulkLoading,setBulkLoading]=useState(false),[bulkError,setBulkError]=useState(''),[sortDesc,setSortDesc]=useState(true);
 const [source,setSource]=useState<'demo'|'dotdb'>('demo');
 const inputRef=useRef<HTMLInputElement>(null),requestRef=useRef<AbortController|null>(null),bulkRef=useRef<AbortController|null>(null);
 const search=useCallback(async(term:string,updateUrl=true)=>{
  const query=normalizeQuery(term);requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;
  setInput(query);setLoading(true);setError('');
  try{const response=await fetch(`/api/search?q=${encodeURIComponent(query)}`,{signal:controller.signal});const data=await response.json() as SearchResult & {error?:string};if(!response.ok)throw new Error(data.error||'Search could not be completed. Please try again.');setResult(data);setSource(data.source);if(updateUrl){const url=new URL(window.location.href);url.searchParams.set('q',query);window.history.replaceState({},'',url);}return data as SearchResult;}
  catch(err){if(controller.signal.aborted)return null;setError(err instanceof Error?err.message:'Something went wrong. Please try again.');return null;}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 const runBulk=useCallback(async(value:string)=>{
  const queries=value.split(/[\s,;]+/).filter(Boolean);if(!queries.length)throw new Error('Add at least one name to compare.');if(queries.length>50)throw new Error('Compare up to 50 names at a time.');
  bulkRef.current?.abort();const controller=new AbortController();bulkRef.current=controller;setBulkLoading(true);setBulkError('');
  try{const response=await fetch('/api/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries}),signal:controller.signal});const data=await response.json() as {source:'demo'|'dotdb';results:BulkRow[];error?:string};if(!response.ok)throw new Error(data.error||'The comparison could not be completed.');setBulkRows(data.results);setSource(data.source);return data;}
  catch(err){if(controller.signal.aborted)return null;setBulkError(err instanceof Error?err.message:'Something went wrong.');return null;}
  finally{if(!controller.signal.aborted)setBulkLoading(false);}
 },[]);
 useEffect(()=>{if(initialView==='search')search(new URLSearchParams(window.location.search).get('q')||'cypress',false).catch(err=>setError(err.message));function shortcut(e:KeyboardEvent){if(e.key==='/'&&!['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)&&!(e.target as HTMLElement)?.isContentEditable){e.preventDefault();if(initialView==='bulk'){router.push('/');return;}setView('search');setTimeout(()=>inputRef.current?.focus(),0);}}window.addEventListener('keydown',shortcut);return()=>{window.removeEventListener('keydown',shortcut);requestRef.current?.abort();bulkRef.current?.abort();};},[search,initialView,router]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:AgentTool,options:{signal:AbortSignal})=>unknown}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
  const register=(tool:AgentTool)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'search_domain_registrations',title:'Search domain registrations',description:'Search and display exact-match extensions. source=demo means illustrative samples, not verified registrations.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async value=>{if(!value||typeof value!=='object'||typeof(value as {query?:unknown}).query!=='string')throw new Error('query must be a string');const query=normalizeQuery((value as {query:string}).query);setView('search');const data=await search(query);if(!data)throw new Error('Search failed');await new Promise(resolve=>requestAnimationFrame(resolve));return {query:data.query,source:data.source,total:data.total,suffixes:data.suffixes,message:data.message};}});
  register({name:'compare_domain_registrations',title:'Compare domain registrations',description:'Compare and display up to 50 names. Sample results are labeled demo and are not verified registration facts.',inputSchema:{type:'object',properties:{queries:{type:'array',items:{type:'string'},minItems:1,maxItems:50}},required:['queries'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async value=>{const queries=(value as {queries?:unknown})?.queries;if(!Array.isArray(queries)||!queries.length||queries.length>50||queries.some(q=>typeof q!=='string'))throw new Error('queries must contain 1–50 strings');const text=queries.join('\n');setView('bulk');setBulkInput(text);const data=await runBulk(text);if(!data)throw new Error('Comparison failed');await new Promise(resolve=>requestAnimationFrame(resolve));return data;}});
  return()=>lifecycle.abort();
 },[runBulk,search]);
 function submit(e:FormEvent){e.preventDefault();search(input).catch(err=>setError(err.message));}
 function selectName(name:string){if(initialView==='bulk'){router.push(`/?q=${encodeURIComponent(name)}`);return;}setView('search');search(name).catch(err=>setError(err.message));}
 const sorted=[...(bulkRows||[])].sort((a,b)=>a.total===null?(b.total===null?0:1):b.total===null?-1:(sortDesc?-1:1)*(a.total-b.total));
 const bulkCount=bulkInput.split(/[\s,;]+/).filter(Boolean).length;
 return <div className="site-shell">
 <a href="#main" className="skip-link">Skip to search</a>
 <SiteHeader active={initialView==='search'?'/':'/bulk-domain-search'}/>
 <div className="preview-strip"><div><span className="preview-label">{source==='demo'?'PREVIEW':'DATA'}</span><span>{source==='demo'?'Explore sample data. Live registration data isn’t connected yet.':'Registration data by dotDB. Counts reflect the provider’s index.'}</span><button onClick={()=>setInfoOpen(true)}>Learn more <ArrowUpRight size={14}/></button></div></div>
 <main id="main" className="workspace">
 {view==='search'&&<section aria-label="Domain search">
  <div className="search-hero"><div className="page-intro"><div className="eyebrow"><span className="tiny-bars" aria-hidden="true"><i/><i/><i/></span>DOMAIN REGISTRATION RESEARCH</div><h1>One name.<br/><span>A world of extensions.</span></h1><p>Look beyond the .com. Explore domain registration counts, inspect the extensions, and put your next great name in perspective.</p><div className="hero-benefits"><span><Check size={15}/>Exact-name search</span><span><Check size={15}/>Bulk comparison</span><span><Check size={15}/>CSV exports</span></div></div><NameIllustration/></div>
  <div className="tool-heading"><span>YOUR RESEARCH STARTS HERE</span><Link href="/how-it-works">How it works <ArrowUpRight size={14}/></Link></div>
  <form className="search-form" onSubmit={submit}><Search className="search-icon" size={23}/><label className="sr-only" htmlFor="domain-search">Name or domain</label><input id="domain-search" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder="Enter a name or domain" autoComplete="off" spellCheck={false} maxLength={253}/><kbd aria-hidden="true">/</kbd><button className="primary-button search-button" disabled={loading} type="submit" aria-label="Count registrations">{loading?<LoaderCircle className="spinning" size={18}/>:<Search size={18}/>}<span>{loading?'Searching':'Count registrations'}</span></button></form>
  <div className="sample-picks"><span>Try a sample:</span>{['cypress','atlas','orbit','nova'].map(name=><button key={name} onClick={()=>selectName(name)}>{name}<ArrowUpRight size={12}/></button>)}<span className="search-hint">Exact names. Clear numbers.</span></div>
  {error&&<div className="error-message" role="alert"><Info size={18}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
  <div className="research-layout research-layout-wide" data-nosnippet>
   <section className="results-panel" aria-label="Search results" aria-busy={loading}>
   {loading?<div className="loading-results" aria-live="polite"><LoaderCircle className="spinning"/><p>Looking up {input}…</p><Skeleton className="h-24 w-full"/><div className="skeleton-grid">{Array.from({length:12},(_,i)=><Skeleton key={i} className="h-16"/>)}</div></div>:result.total===null?<div className="empty-results"><div className="empty-symbol"><Search size={28}/></div><span className="sample-badge">SAMPLE COLLECTION</span><h2>No sample for “{result.query}”</h2><p>{result.message}</p><button className="primary-button" onClick={()=>selectName('cypress')}>Explore cypress <ArrowRight size={17}/></button></div>:<SearchResults key={`${result.source}-${result.query}-${result.fetchedAt}`} result={result} onSelectName={selectName}/>}
   </section>
   <aside className="research-sidebar">
    <div className="insight-card"><div className="card-icon"><Globe2 size={23}/></div><h3>A name’s bigger picture.</h3><p>One keyword can live across hundreds of extensions. Its registration count is one signal of how broadly it’s used.</p><div className="insight-note"><Info size={16}/><span>A research signal, not a valuation.</span></div><Link className="insight-link" href="/guides/domain-registration-count">Make sense of the count <ArrowRight size={15}/></Link></div>
    <div className="examples-card"><div className="aside-heading"><h3>Explore the samples</h3><Sparkles size={17}/></div>{SAMPLE_NAMES.filter(n=>n!==result.query).slice(0,4).map(name=><button className="sample-row" key={name} onClick={()=>selectName(name)}><span>{name}</span><span className="sample-row-count">{demoResult(name).total}<ChevronRight size={15}/></span></button>)}<p>Illustrative counts, not verified registrations.</p></div>
    <Link className="bulk-callout" href="/bulk-domain-search"><span className="bulk-callout-icon"><Layers3 size={20}/></span><span><strong>A list to research?</strong><small>Compare names in bulk</small></span><ArrowRight size={18}/></Link>
   </aside>
  </div>
 </section>}
 {view==='bulk'&&<section aria-label="Bulk domain search">
  <div className="page-intro bulk-intro"><div className="eyebrow"><Layers3 size={16}/>BULK RESEARCH</div><h1>Bulk domain search.<br/><span>One clear comparison.</span></h1><p>Compare exact-match extension counts for up to 50 names at once.</p></div>
  <div className="bulk-layout"><section className="bulk-input-panel"><div className="panel-title"><h2>Your names</h2><button onClick={()=>setBulkInput(SAMPLE_NAMES.join('\n'))}>Load sample list</button></div><label htmlFor="bulk-names">One name or domain per line</label><textarea id="bulk-names" value={bulkInput} onChange={e=>setBulkInput(e.target.value)} placeholder={'cypress\natlas.com\norbit.io'} spellCheck={false} maxLength={13000}/><div className="bulk-input-meta"><span>{bulkCount} / 50 names</span><button onClick={()=>{setBulkInput('');setBulkRows(null);setBulkError('');}} disabled={bulkLoading}>Clear</button></div><button className="primary-button bulk-submit" disabled={bulkLoading} onClick={()=>runBulk(bulkInput).catch(err=>setBulkError(err.message))}>{bulkLoading?<LoaderCircle className="spinning" size={18}/>:<Layers3 size={18}/>} {bulkLoading?'Comparing names…':'Compare registrations'}</button><p className="input-footnote">Duplicates are combined. Extensions are removed to compare the underlying names.</p></section>
   <section className="bulk-results-panel" aria-busy={bulkLoading} data-nosnippet><div className="panel-title"><h2>Comparison</h2>{bulkRows&&<button onClick={()=>downloadCsv(`regcount-comparison-${source}.csv`,[['Name','Extension count','Data source','Note'],...sorted.map(row=>[row.query,row.total,row.source==='demo'?'ILLUSTRATIVE SAMPLE — NOT VERIFIED':'dotDB',row.error||''])])}><Download size={16}/>Download CSV</button>}</div>
    {bulkError&&<div className="error-message" role="alert"><Info size={18}/>{bulkError}</div>}
    {bulkLoading?<div className="bulk-empty"><LoaderCircle className="spinning" size={28}/><h3>Counting across your list…</h3><p>Comparing names and collecting their extension counts.</p></div>:!bulkRows?<div className="bulk-empty"><div className="empty-symbol"><ListTree size={32}/></div><h3>Big picture. Side by side.</h3><p>Add your names to see which ones have the broadest reach across extensions.</p><button onClick={()=>{const text=SAMPLE_NAMES.join('\n');setBulkInput(text);runBulk(text).catch(err=>setBulkError(err.message));}}>Try a sample comparison <ArrowRight size={16}/></button></div>:<><Table className="bulk-table"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Name</TableHead><TableHead><button onClick={()=>setSortDesc(!sortDesc)}>Extensions {sortDesc?<ArrowDown size={14}/>:<ArrowDownUp size={14}/>}</button></TableHead><TableHead>Data</TableHead></TableRow></TableHeader><TableBody>{sorted.map((row,index)=><TableRow key={row.query}><TableCell className="rank">{index+1}</TableCell><TableCell><button className="domain-button" onClick={()=>selectName(row.query)}>{row.query}<ArrowUpRight size={13}/></button>{row.error&&<small className="row-error">{row.error}</small>}</TableCell><TableCell><span className="bulk-count">{row.total===null?'—':row.total}</span>{row.total!==null&&<span className="mini-bar" style={{width:`${Math.max(4,(row.total/Math.max(...sorted.map(r=>r.total||0),1))*64)}px`}}/>}</TableCell><TableCell><span className="sample-badge">{row.source==='demo'?'SAMPLE':'DOTDB'}</span></TableCell></TableRow>)}</TableBody></Table><div className="results-bottom"><span>{bulkRows.length} unique names · {source==='demo'?'Illustrative data only':'Provider-indexed registrations'}</span></div></>}
   </section>
  </div>
 </section>}
 <div className="data-note"><ShieldCheck size={17}/><p>{source==='demo'?'Sample counts demonstrate the product. They are not registration or availability checks.':'Counts reflect the provider’s index. A missing extension does not mean a domain is available.'}</p><button onClick={()=>setInfoOpen(true)}>How counts work <ArrowUpRight size={14}/></button></div>
 {children}
 </main>
 <SiteFooter/>
 <Dialog open={infoOpen} onOpenChange={setInfoOpen}><DialogContent className="data-dialog"><DialogHeader><div className="dialog-mark"><Globe2 size={25}/></div><DialogTitle>Know what you’re counting.</DialogTitle><DialogDescription>RegCount measures the number of distinct extensions found for an exact name in its data source.</DialogDescription></DialogHeader><div className="dialog-copy"><h3>{source==='demo'?'You’re viewing sample data':'Registration data by dotDB'}</h3><p>{source==='demo'?'These names, counts, and extension lists are illustrative. Explore search, filtering, bulk comparison, and exports. The examples have not been checked against actual registrations.':'Searches use dotDB’s index. Results can lag new registrations and depend on the extensions and domains covered by the provider.'}</p><h3>Exact matches, not related words</h3><p>A search for “cypress” counts cypress.com and cypress.net separately. getcypress.com belongs in related results and does not increase the exact-match count.</p><h3>Coverage has limits</h3><p>DNS visibility, country-code coverage, and update timing affect counts. This is not a live availability check. Country codes include .ai, .io, and .co.</p><h3>Multi-part extensions</h3><p>Suffixes are displayed as supplied by the source. For example, .uk and .co.uk may count separately.</p></div></DialogContent></Dialog>
 </div>;
}
