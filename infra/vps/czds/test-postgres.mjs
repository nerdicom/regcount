// Run against a disposable PGlite PostgreSQL 17 instance; no live CZDS data.
// npm install --prefix /tmp/regcount-pg-tests @electric-sql/pglite@0.3.14
// PGLITE_MODULE=/tmp/regcount-pg-tests/node_modules/@electric-sql/pglite/dist/index.js node infra/vps/czds/test-postgres.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
process.on('uncaughtException', error => { console.error(error.message, error.query || ''); process.exit(1); });
const here = new URL('.', import.meta.url);
const pg = new PGlite();
const schema = readFileSync(new URL('schema.sql', here), 'utf8');
const dbName = (await pg.query('SELECT current_database() AS name')).rows[0].name;
for (const statement of schema.replace('ON DATABASE regcount', `ON DATABASE "${dbName}"`).split(';')) {
  // PGlite uses a synthetic template1 database catalog; database-level GRANT
  // is validated on the VPS, not in this embedded test.
  if (statement.trim().startsWith('GRANT CONNECT, TEMPORARY ON DATABASE')) continue;
  if (statement.trim()) await pg.exec(statement);
}
const cases = JSON.parse(execFileSync('python3', [fileURLToPath(new URL('test_czds.py', here)), '--sql-cases']));
const snapshot = async () => (await pg.query('SELECT label,tld FROM domain_index.domains ORDER BY label,tld')).rows;
let passed = 0;
for (const test of cases) {
  const before = await snapshot();
  const beforeMeta = (await pg.query('SELECT * FROM domain_index.zones ORDER BY tld')).rows;
  try {
    await pg.exec(test.begin);
    // PGlite's file-device COPY needs superuser; all generated DDL/DML runs
    // under the actual restricted ingest role. Production uses COPY STDIN.
    await pg.exec('RESET ROLE');
    await pg.query("COPY incoming(label) FROM '/dev/blob'", [], { blob: new Blob([test.copy]) });
    await pg.exec('SET ROLE regcount_ingest');
    await pg.exec(test.finish);
    if (['large_drop', 'old_serial'].includes(test.name)) assert.fail(`${test.name} should fail`);
    await pg.exec(test.name === 'interrupted' ? 'ROLLBACK' : 'COMMIT');
  } catch (error) {
    await pg.exec('ROLLBACK');
    if (!['large_drop', 'old_serial'].includes(test.name)) throw error;
    assert.match(error.message, test.name === 'large_drop' ? /20 percent/ : /SOA serial/);
  }
  const after = await snapshot();
  if (['large_drop', 'old_serial', 'interrupted'].includes(test.name)) {
    assert.deepEqual(after, before, `${test.name} must preserve prior domains`);
    assert.deepEqual((await pg.query('SELECT * FROM domain_index.zones ORDER BY tld')).rows, beforeMeta);
  }
  if (test.name === 'initial') assert.deepEqual(after, [{ label: 'alpha', tld: 'test' }, { label: 'beta', tld: 'test' }]);
  if (test.name === 'refresh') assert.deepEqual(after, [{ label: 'alpha', tld: 'other' }, { label: 'alpha', tld: 'test' }, { label: 'gamma', tld: 'test' }]);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='domain_index' AND tablename LIKE '%_next'")).rows[0].n, 0);
  console.log(`PASS ${test.name}`);
  passed++;
}
const result = await pg.query("SELECT count(DISTINCT tld)::int AS extensions FROM domain_index.domains WHERE label='alpha'");
assert.equal(result.rows[0].extensions, 2);
console.log(`PASS exact-name count across extensions; ${passed} transaction scenarios passed`);
console.log((await pg.query('SELECT version()')).rows[0].version);
await pg.close();
