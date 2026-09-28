import assert from 'node:assert/strict';
import {test} from 'node:test';
import {advancedSearch} from './advanced.mjs';
import {createSearchServer} from './http.mjs';
import {parseResearchParams,researchParams,matchesResearchName} from './query.mjs';
import {verifyAdvanced} from './verify-advanced.mjs';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const params=(values)=>new URLSearchParams({q:'cypress',...values});

test('advanced validation prevents malformed, ambiguous and unbounded searches',()=>{
  for(const values of [{q:"x' OR 1=1"},{q:'a'.repeat(64)},{min:'0'},{min:'10',max:'3'},{sort:'random()'},{tlds:'dev,com);'},{omit:'sql'},{exclude:'%foo'},{page:'101'},{page:'2'},{snapshot:'no'}])assert.throws(()=>parseResearchParams(params(values)));
  assert.throws(()=>parseResearchParams(new URLSearchParams('q=abc&q=def')));
  assert.throws(()=>parseResearchParams(params({sql:'1'})));
  const options=parseResearchParams(params({q:' New   York ',tlds:'.org,dev',exclude:'shop free',omit:'digits,hyphens'}));
  assert.equal(options.q,'new york');assert.deepEqual(options.tlds,['dev','org']);
  assert(matchesResearchName('newbigyork',options));assert(!matchesResearchName('yorknew',options));
  assert(!matchesResearchName('newyork9',options));assert(!matchesResearchName('newyorkshop',options));
  assert.deepEqual(parseResearchParams(researchParams(options)),options);
});

test('complete PostgreSQL ranking, filters, totals, pagination and immutable coverage',async()=>{
  const db=new PGlite();
  const pool={connect:async()=>({query:(sql,values)=>db.query(sql,values),release(){}})};
  try {
    await db.exec(`CREATE SCHEMA domain_index;
      CREATE TABLE domain_index.domains(label text COLLATE "C",tld text COLLATE "C",PRIMARY KEY(label,tld));
      CREATE TABLE domain_index.zones(tld text PRIMARY KEY,domain_count bigint,downloaded_at timestamptz,imported_at timestamptz);
      INSERT INTO domain_index.zones VALUES ('dev',200,now(),now()),('org',100,now(),now()),('app',100,now(),now());
      INSERT INTO domain_index.domains VALUES ('cypress','dev'),('cypress','org'),('cypress-park','org'),('getcypress','dev'),('cypressshop','org'),('xn--cypress','dev'),('newyork','dev'),('newbigyork','org'),('yorknew','dev'),('newyorktour','app');
      INSERT INTO domain_index.domains SELECT 'acypress'||lpad(i::text,3,'0'),'dev' FROM generate_series(1,140) i;
      INSERT INTO domain_index.domains VALUES ('zzcypress','dev'),('zzcypress','org'),('zzcypress','app');
      CREATE ROLE advanced_reader;GRANT USAGE ON SCHEMA domain_index TO advanced_reader;GRANT SELECT ON domain_index.domains,domain_index.zones TO advanced_reader;SET ROLE advanced_reader;`);
    const first=await advancedSearch(pool,params({sort:'count_desc'}));
    // This alphabetically late high-count name was absent from the old 100-name candidate set.
    assert.equal(first.related[0].name,'zzcypress');assert.equal(first.related[0].count,3);
    assert.equal(first.total,2);assert.equal(first.research.keywordCount,146);assert.equal(first.research.domainCount,149);
    assert.equal(first.research.relatedTotal,145);assert.equal(first.related.length,50);assert.equal(first.research.totalPages,3);
    const pages=[first];
    for(let page=2;page<=3;page++)pages.push(await advancedSearch(pool,params({sort:'count_desc',page:String(page),snapshot:first.research.snapshot})));
    const all=pages.flatMap(p=>p.related);assert.equal(all.length,145);assert.equal(new Set(all.map(r=>r.name)).size,145);
    assert(!pages[2].research.hasNext);
    const filtered=await advancedSearch(pool,params({omit:'digits,hyphens',exclude:'shop',tlds:'org'}));
    assert.equal(filtered.total,1);assert.deepEqual(filtered.related.map(r=>r.name),['zzcypress']);assert.equal(filtered.research.domainCount,2);
    const lengths=await advancedSearch(pool,params({min:'11',max:'11',position:'beginning'}));
    assert.deepEqual(lengths.related.map(r=>r.name),['cypressshop']);
    const multi=await advancedSearch(pool,params({q:'new york'}));
    assert.equal(multi.exactName,'newyork');assert.equal(multi.total,1);assert.deepEqual(multi.related.map(r=>r.name),['newbigyork','newyorktour']);
    const none=await advancedSearch(pool,params({q:'nothingmatched'}));assert.equal(none.research.keywordCount,0);assert.equal(none.total,0);
    const short=await advancedSearch(pool,params({q:'ai'}));assert.equal(short.research.keywordCount,null);assert.equal(short.research.totalPages,null);
    await assert.rejects(advancedSearch(pool,params({tlds:'com'})),e=>e.status===422);
    await assert.rejects(db.query('DELETE FROM domain_index.domains'),/permission denied/);
    const timedPool={connect:async()=>({release(){},query(sql,values){if(sql.includes('WITH matches'))throw Object.assign(Error('timeout'),{code:'57014'});return db.query(sql,values);}})};
    const timeout=await advancedSearch(timedPool,params({sort:'count_desc'}));
    assert.equal(timeout.total,2);assert.equal(timeout.related.length,0);assert.equal(timeout.research.keywordCount,null);assert.equal(timeout.research.timedOut,true);
    // A failed advanced search leaves the connection usable and existing data intact.
    assert.equal((await advancedSearch(pool,params({q:'new york'}))).total,1);
    await db.exec("RESET ROLE;UPDATE domain_index.zones SET downloaded_at=downloaded_at+interval '1 day';SET ROLE advanced_reader;");
    await assert.rejects(advancedSearch(pool,params({page:'2',snapshot:first.research.snapshot})),e=>e.status===409);
    const server=createSearchServer({pool,token:'a'.repeat(64)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+'a'.repeat(64)};
    try {
      assert.equal((await fetch(origin+'/v2/search?q=cypress')).status,401);
      const response=await fetch(origin+'/v2/search?q=cypress&sort=count_desc',{headers});assert.equal(response.status,200);assert.equal((await response.json()).related[0].name,'zzcypress');
      assert.equal((await fetch(origin+'/v2/search?q=cypress&tlds=ai',{headers})).status,422);
      assert.equal((await fetch(origin+'/v2/search?q=cypress&page=2',{headers})).status,400);
      assert.equal((await fetch(origin+'/v1/search?q=cypress',{headers})).status,200);
      const checks=[];
      const verified=await verifyAdvanced({request:async path=>{
        const response=await fetch(origin+path,{headers});assert.equal(response.status,200);return response.json();
      },log:line=>checks.push(line)});
      assert.equal(verified.limited,0);
      assert(checks.some(line=>line.startsWith('PASS: Second page')));
      assert.equal(checks.filter(line=>line.startsWith('PASS:')).length,5);
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  } finally {await db.close();}
});
