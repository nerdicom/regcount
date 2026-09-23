import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const folder=await mkdtemp(join(tmpdir(),'regcount-czds-'));
const nativeFetch=globalThis.fetch;
const names=['REGCOUNT_LIVE_ENABLED','REGCOUNT_DATA_SOURCE','REGCOUNT_CZDS_API_URL','REGCOUNT_CZDS_API_TOKEN'];
const original=new Map(names.map(name=>[name,process.env[name]]));
const token='c'.repeat(64), now=new Date().toISOString();
const coverage={basis:'delegated-domains',zones:[{tld:'dev',domainCount:20,downloadedAt:now,importedAt:now,stale:false}],requiredMissing:['com','net','ai']};
const result={query:'cypress',position:'beginning',source:'czds',total:1,suffixes:['dev'],related:[{name:'cypresslabs',count:1,suffixes:['dev']}],relatedPartial:false,fetchedAt:now,coverage};
try {
 for(const name of ['domains','provider-error','czds-provider','registration-provider']){
  const source=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  await writeFile(join(folder,name+'.mjs'),compiled.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
 }
 const {searchRegistrations,dataMode}=await import(pathToFileURL(join(folder,'registration-provider.mjs')));
 const {bulkCZDS,validateCoverage}=await import(pathToFileURL(join(folder,'czds-provider.mjs')));
 process.env.REGCOUNT_LIVE_ENABLED='true';process.env.REGCOUNT_DATA_SOURCE='czds';
 process.env.REGCOUNT_CZDS_API_URL='https://data.regcount.test';process.env.REGCOUNT_CZDS_API_TOKEN=token;
 let payload=result,status=200,calls=0;
 globalThis.fetch=async(input,options)=>{
  calls++;const url=new URL(input);
  assert.equal(url.origin,'https://data.regcount.test');assert.equal(options.headers.Authorization,'Bearer '+token);
  assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  if(url.pathname==='/v1/search'){assert.equal(url.searchParams.get('q'),'cypress');assert.equal(url.searchParams.get('position'),'beginning');}
  else {assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body).queries,['cypress','unknown']);}
  return Response.json(payload,{status});
 };
 assert.equal(dataMode(),'czds');
 const found=await searchRegistrations('CYPRESS.dev','beginning');
 assert.equal(found.source,'czds');assert.equal(found.total,1);assert.equal(found.coverage.zones.length,1);
 assert(!JSON.stringify(found).includes(token));
 payload={...result,total:0,suffixes:[],related:[],relatedPartial:true,relatedMessage:'The related-name search reached its time limit.'};
 const zero=await searchRegistrations('cypress','beginning');assert.equal(zero.total,0);assert.equal(zero.relatedPartial,true);
 status=401;await assert.rejects(searchRegistrations('cypress','beginning'),/unavailable/);
 status=429;await assert.rejects(searchRegistrations('cypress','beginning'),error=>error.status===429);
 status=200;
 for(const broken of [{...result,total:5},{...result,suffixes:['com']},{...result,related:[{name:'getcypress',count:1,suffixes:['dev']}]},{...result,coverage:{...coverage,zones:[]}}]){
  payload=broken;await assert.rejects(searchRegistrations('cypress','beginning'),/unexpected/);
 }
 payload={source:'czds',coverage,results:[{query:'cypress',source:'czds',total:1,suffixes:['dev']},{query:'unknown',source:'czds',total:0,suffixes:[]}]};
 assert.deepEqual((await bulkCZDS(['cypress','unknown'])).results.map(row=>row.total),[1,0]);
 payload.results[1].query='cypress';await assert.rejects(bulkCZDS(['cypress','unknown']),/unexpected/);
 assert.equal(validateCoverage({...coverage,zones:[{...coverage.zones[0],downloadedAt:'2020-01-01T00:00:00Z'}]}).zones[0].stale,true);
 const before=calls;process.env.REGCOUNT_CZDS_API_URL='http://data.regcount.test';
 await assert.rejects(searchRegistrations('cypress','beginning'),/configured/);assert.equal(calls,before);
 process.env.REGCOUNT_CZDS_API_URL='https://data.regcount.test';delete process.env.REGCOUNT_CZDS_API_TOKEN;
 await assert.rejects(searchRegistrations('cypress','beginning'),/configured/);assert.equal(calls,before);
 process.env.REGCOUNT_LIVE_ENABLED='false';assert.equal((await searchRegistrations('cypress')).source,'demo');assert.equal(calls,before);
 console.log('Passed: CZDS mode, normalized searches, private HTTPS credentials, strict coverage validation, known zero, stale snapshots, bulk results, and no silent sample fallback.');
} finally {
 globalThis.fetch=nativeFetch;for(const [name,value] of original){if(value===undefined)delete process.env[name];else process.env[name]=value;}
 await rm(folder,{recursive:true,force:true});
}
