// Query only the importer's committed parent table, in one consistent snapshot.
export const REQUIRED_TLDS = ['com', 'net', 'org', 'ai', 'si', 'io', 'xyz', 'app', 'dev', 'so'];
export class SearchError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}
export function validateQuery(value) {
  if (typeof value !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) {
    throw new SearchError('Send a normalized domain keyword of 1–63 characters.', 400);
  }
  return value;
}
export function validatePosition(value = 'any') {
  if (!['any', 'beginning', 'end'].includes(value)) throw new SearchError('Invalid keyword position.', 400);
  return value;
}
export function coverageFromRows(rows, now = Date.now()) {
  if (!rows.length) throw new SearchError('No imported extensions are available yet.');
  const zones = rows.map(row => ({
    tld: row.tld, domainCount: Number(row.domain_count),
    downloadedAt: new Date(row.downloaded_at).toISOString(),
    importedAt: new Date(row.imported_at).toISOString(),
    stale: now - new Date(row.downloaded_at).getTime() > 72 * 3600 * 1000,
  }));
  return { basis: 'delegated-domains', zones,
    requiredMissing: REQUIRED_TLDS.filter(tld => !zones.some(zone => zone.tld === tld)) };
}
async function transaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '4s'");
    await client.query("SET LOCAL lock_timeout = '750ms'");
    const rows = (await client.query('SELECT tld, domain_count, downloaded_at, imported_at FROM domain_index.zones ORDER BY tld')).rows;
    const coverage = coverageFromRows(rows);
    const value = await callback(client, coverage);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
async function extensions(client, queries) {
  return (await client.query(`SELECT label, array_agg(tld ORDER BY tld) AS suffixes
    FROM domain_index.domains WHERE label = ANY($1::text[]) GROUP BY label`, [queries])).rows;
}
export async function search(pool, query, position = 'any', exactOnly = false) {
  validateQuery(query); validatePosition(position);
  return transaction(pool, async (client, coverage) => {
    const suffixes = (await extensions(client, [query]))[0]?.suffixes || [];
    let related = [], relatedPartial = false, relatedMessage;
    if (!exactOnly && query.length < 3) {
      relatedPartial = true;
      relatedMessage = 'Use at least 3 characters for related-name searches. The exact-name count is shown.';
    } else if (!exactOnly) {
      // No unbounded count/sort over the entire dataset. Fetch a bounded alphabetic
      // candidate set, then get complete extension counts for those candidates.
      const pattern = position === 'beginning' ? query + '%' : position === 'end' ? '%' + query : '%' + query + '%';
      await client.query('SAVEPOINT related_search');
      try {
        await client.query("SET LOCAL statement_timeout = '2500ms'");
        const names = (await client.query(`SELECT DISTINCT label FROM domain_index.domains
          WHERE label LIKE $1 AND label <> $2 ORDER BY label LIMIT 101`, [pattern, query])).rows;
        relatedPartial = names.length > 100;
        const matches = await extensions(client, names.slice(0, 100).map(row => row.label));
        related = matches.map(row => ({ name: row.label, suffixes: row.suffixes, count: row.suffixes.length }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        if (relatedPartial) relatedMessage = 'Showing up to 100 alphabetically selected matching names, sorted by count. More matches may exist.';
        await client.query('RELEASE SAVEPOINT related_search');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT related_search');
        if (!['57014', '55P03'].includes(error.code)) throw error;
        relatedPartial = true;
        relatedMessage = 'The related-name search reached its time limit. Try a longer keyword or Beginning. The exact-name count is still available.';
      }
    }
    return { query, position, source: 'czds', total: suffixes.length, suffixes,
      related, relatedPartial, ...(relatedMessage ? { relatedMessage } : {}),
      fetchedAt: new Date().toISOString(), coverage };
  });
}
export async function bulk(pool, queries) {
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > 50) throw new SearchError('Send 1–50 names.', 400);
  queries.forEach(validateQuery);
  const unique = [...new Set(queries)];
  return transaction(pool, async (client, coverage) => {
    const rows = await extensions(client, unique);
    const byName = new Map(rows.map(row => [row.label, row.suffixes]));
    return { source: 'czds', coverage, results: unique.map(query => ({ query, source: 'czds',
      total: (byName.get(query) || []).length, suffixes: byName.get(query) || [], coverage })) };
  });
}
export async function status(pool) {
  return transaction(pool, async (_client, coverage) => ({ status: 'ready', coverage }));
}
