import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {advancedSearch} from '../infra/vps/search/advanced.mjs';
import {parseResearchParams} from '../infra/vps/search/query.mjs';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const folder=await mkdtemp(join(tmpdir(),'regcount-research-')),nativeFetch=globalThis.fetch;
const names=['REGCOUNT_LIVE_ENABLED','REGCOUNT_DATA_SOURCE','REGCOUNT_CZDS_API_URL','REGCOUNT_CZDS_API_TOKEN'];
const original=new Map(names.map(name=>[name,process.env[name]]));
const db=new PGlite();
try {
  await mkdir(join(folder,'lib'));await mkdir(join(folder,'infra/vps/search'),{recursive:true});
  await writeFile(join(folder,'infra/vps/search/query.mjs'),await readFile(new URL('../infra/vps/search/query.mjs',import.meta.url)));
  for(const name of ['domains','provider-error','czds-provider','registration-provider','research-provider']){
    const source=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
    await writeFile(join(folder,'lib',name+'.mjs'),compiled.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
  }
  const {researchSearch}=await import(pathToFileURL(join(folder,'lib/research-provider.mjs')));
  await db.exec(`CREATE SCHEMA domain_index;CREATE TABLE domain_index.domains(label text,tld text,PRIMARY KEY(label,tld));
    CREATE TABLE domain_index.zones(tld text,domain_count bigint,downloaded_at timestamptz,imported_at timestamptz);
    INSERT INTO domain_index.zones VALUES ('dev',4,now(),now()),('org',2,now(),now());
    INSERT INTO domain_index.domains VALUES ('cypress','dev'),('cypress','org'),('getcypress','dev'),('zzcypress','dev'),('zzcypress','org');`);
  const pool={connect:async()=>({query:(sql,values)=>db.query(sql,values),release(){}})};
  const options=parseResearchParams(new URLSearchParams({q:'cypress',sort:'count_desc'}));
  const actual=await advancedSearch(pool,new URLSearchParams({q:'cypress',sort:'count_desc'}));
  let payload=actual,status=200,calls=0;
  process.env.REGCOUNT_LIVE_ENABLED='true';process.env.REGCOUNT_DATA_SOURCE='czds';
  process.env.REGCOUNT_CZDS_API_URL='https://data.regcount.test';process.env.REGCOUNT_CZDS_API_TOKEN='a'.repeat(64);
  globalThis.fetch=async(input,init)=>{
    calls++;const url=new URL(input);assert.equal(url.origin,'https://data.regcount.test');assert.equal(url.pathname,'/v2/search');
    assert.equal(init.headers.Authorization,'Bearer '+'a'.repeat(64));assert.equal(init.redirect,'error');
    return Response.json(payload,{status});
  };
  const found=await researchSearch(options);assert.equal(found.total,2);assert.equal(found.related[0].name,'zzcypress');assert.equal(found.research.keywordCount,3);
  for(const mutate of [p=>p.related.reverse(),p=>p.related[0].suffixes.push('com'),p=>p.research.keywordCount=1,p=>p.research.hasNext=true,p=>p.research.options.sort='name',p=>p.research.snapshot='bad',p=>p.exactName='bad']){
    payload=structuredClone(actual);mutate(payload);await assert.rejects(researchSearch(options));
  }
  payload={error:'private details must not be shown'};
  for(const code of [404,409,422,429,500]){status=code;await assert.rejects(researchSearch(options),error=>!error.message.includes('private details')&&error.status===(code===404||code===500?503:code));}
  status=200;
  const short=parseResearchParams(new URLSearchParams({q:'ai'}));payload=await advancedSearch(pool,new URLSearchParams({q:'ai'}));
  assert.equal((await researchSearch(short)).research.keywordCount,null);
  process.env.REGCOUNT_LIVE_ENABLED='false';const before=calls;
  const sample=await researchSearch(options);assert.equal(sample.source,'demo');assert.equal(calls,before);
  assert.equal((await researchSearch(parseResearchParams(new URLSearchParams({q:'nothingmatches'})))).total,null);
  console.log('Passed: actual PostgreSQL response through website adapter, full ranking, coverage, option echo, totals consistency, unknown counts, provider errors, and labeled demo fallback only when explicitly configured.');
} finally {
  globalThis.fetch=nativeFetch;for(const [name,value]of original){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  await db.close();await rm(folder,{recursive:true,force:true});
}
