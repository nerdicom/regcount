import assert from 'node:assert/strict';
import { test } from 'node:test';
import { search, bulk, status, coverageFromRows } from './database.mjs';
import { createSearchServer } from './http.mjs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('real PostgreSQL queries, coverage, bounded results, role permissions and HTTP protection', async () => {
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA domain_index;
    CREATE TABLE domain_index.domains (label text COLLATE "C", tld text COLLATE "C", PRIMARY KEY(label,tld)) PARTITION BY LIST(tld);
    CREATE TABLE domain_index.dev PARTITION OF domain_index.domains FOR VALUES IN ('dev');
    CREATE TABLE domain_index.org PARTITION OF domain_index.domains FOR VALUES IN ('org');
    CREATE TABLE domain_index.zones (tld text PRIMARY KEY,domain_count bigint,downloaded_at timestamptz,imported_at timestamptz);
    INSERT INTO domain_index.zones VALUES ('dev',5,now(),now()),('org',3,now()-interval '4 days',now());
    INSERT INTO domain_index.domains VALUES ('cypress','dev'),('cypress','org'),('cypresslabs','dev'),('getcypress','dev'),('getcypress','org'),('mycypress','org'),('mycypresslabs','dev');
    CREATE ROLE regcount_search_test;
    GRANT USAGE ON SCHEMA domain_index TO regcount_search_test;
    GRANT SELECT ON domain_index.domains,domain_index.zones TO regcount_search_test;
    SET ROLE regcount_search_test;`);
  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  try {
    const any = await search(pool, 'cypress', 'any');
    assert.equal(any.total, 2);
    assert.deepEqual(any.suffixes, ['dev','org']);
    assert.equal(any.related.length, 4);
    assert.equal(any.related.find(row=>row.name==='getcypress').count, 2);
    assert.deepEqual((await search(pool, 'cypress', 'beginning')).related.map(row=>row.name), ['cypresslabs']);
    assert.deepEqual((await search(pool, 'cypress', 'end')).related.map(row=>row.name), ['getcypress','mycypress']);
    assert.equal((await search(pool, 'yp', 'any')).total, 0);
    assert.equal((await search(pool, 'yp', 'any')).relatedPartial, true);
    assert.equal(any.coverage.zones.find(zone=>zone.tld==='org').stale, true);
    assert(any.coverage.requiredMissing.includes('com'));
    assert(!any.coverage.requiredMissing.includes('dev'));
    assert.equal((await search(pool, 'missing')).total, 0);
    assert.deepEqual((await bulk(pool,['cypress','missing','cypress'])).results.map(row=>row.total), [2,0]);
    await assert.rejects(search(pool,"x' OR true--"), /normalized/);
    await assert.rejects(search(pool,'cypress','shuffle'), /position/);
    await assert.rejects(db.query('DELETE FROM domain_index.domains'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM domain_index.dev'), /permission denied/);
    assert.equal((await status(pool)).coverage.zones.length,2);
    assert.throws(()=>coverageFromRows([]),/No imported/);

    // The importer replaces partitions; a grant on the parent must still work.
    await db.exec(`RESET ROLE; BEGIN; DROP TABLE domain_index.dev;
      CREATE TABLE domain_index.dev_new PARTITION OF domain_index.domains FOR VALUES IN ('dev');
      INSERT INTO domain_index.dev_new VALUES ('cypress','dev');
      INSERT INTO domain_index.dev_new SELECT 'cypress'||lpad(i::text,3,'0'),'dev' FROM generate_series(1,125) i;
      COMMIT; SET ROLE regcount_search_test;`);
    const bounded = await search(pool,'cypress','beginning');
    assert.equal(bounded.related.length,100);
    assert.equal(bounded.relatedPartial,true);
    assert.equal(bounded.total,2);
    assert.match(bounded.relatedMessage,/alphabetically/);
    const timeoutPool={connect:async()=>({release(){},query(sql,values){
      if(sql.includes('SELECT DISTINCT label')) throw Object.assign(new Error('forced timeout'),{code:'57014'});
      return db.query(sql,values);
    }})};
    const timed = await search(timeoutPool,'cypress');
    assert.equal(timed.total,2); assert.equal(timed.relatedPartial,true); assert.match(timed.relatedMessage,/time limit/);
    assert.equal((await search(pool,'cypress','any',true)).relatedPartial,false);

    const token='a'.repeat(64), server=createSearchServer({pool,token});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const auth={Authorization:'Bearer '+token};
    try {
      assert.equal((await fetch(origin+'/healthz')).status,200);
      assert.equal((await fetch(origin+'/v1/status')).status,401);
      assert.equal((await fetch(origin+'/v1/search?q=cypress',{headers:auth})).status,200);
      assert.equal((await fetch(origin+'/v1/search?q=cypress&q=other',{headers:auth})).status,400);
      assert.equal((await fetch(origin+'/v1/search?q=cypress&position=shuffle',{headers:auth})).status,400);
      const bulkResponse=await fetch(origin+'/v1/bulk',{method:'POST',headers:auth,body:JSON.stringify({queries:['cypress','unknown']})});
      assert.deepEqual((await bulkResponse.json()).results.map(row=>row.total),[2,0]);
      assert.equal((await fetch(origin+'/v1/bulk',{method:'POST',headers:auth,body:'bad json'})).status,400);
      assert.equal((await fetch(origin+'/v1/bulk',{method:'POST',headers:auth,body:'x'.repeat(21000)})).status,413);
    } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
  } finally { await db.close(); }
});

test('global rate limit and concurrency cap prevent unbounded database work', async () => {
  const token='b'.repeat(64);
  const failingPool={connect:async()=>{throw Error('secret connection details');}};
  const server=createSearchServer({pool:failingPool,token,now:()=>1000});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/v1/status',headers={Authorization:'Bearer '+token};
  try {
    for(let n=0;n<30;n++) {const res=await fetch(url,{headers});assert.equal(res.status,503);assert(!JSON.stringify(await res.json()).includes('secret'));}
    assert.equal((await fetch(url,{headers})).status,429);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  const resolvers=[];
  const busy=createSearchServer({token,pool:{connect:()=>new Promise((_,reject)=>resolvers.push(reject))}});
  await new Promise(resolve=>busy.listen(0,'127.0.0.1',resolve));
  const busyUrl='http://127.0.0.1:'+busy.address().port+'/v1/status';
  const waiting=Array.from({length:4},()=>fetch(busyUrl,{headers}));
  try {
    for(let n=0;n<100&&resolvers.length<4;n++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(resolvers.length,4);
    assert.equal((await fetch(busyUrl,{headers})).status,503);
  } finally {resolvers.forEach(reject=>reject(Error('busy')));await Promise.all(waiting);busy.closeAllConnections();await new Promise(resolve=>busy.close(resolve));}
});
