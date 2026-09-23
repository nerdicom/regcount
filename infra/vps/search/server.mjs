import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createSearchServer } from './http.mjs';
const pool = new pg.Pool({ host: 'regcount-data-db-1', database: 'regcount', user: 'regcount_search',
  password: readFileSync('/run/secrets/search_db_password', 'utf8').trim(),
  max: 4, connectionTimeoutMillis: 1500, idleTimeoutMillis: 30000,
  statement_timeout: 4000, application_name: 'regcount-search' });
pool.on('error', () => console.error('Database connection unavailable.'));
const server = createSearchServer({ pool, token: readFileSync('/run/secrets/search_api_token', 'utf8').trim() });
server.listen(8787, '0.0.0.0', () => console.log('RegCount search service started.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
});
