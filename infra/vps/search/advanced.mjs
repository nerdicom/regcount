import { createHash } from 'node:crypto';
import { transaction, SearchError } from './database.mjs';
import { parseResearchParams, PAGE_SIZE, MAX_PAGE } from './query.mjs';

// Values always use SQL parameters; order clauses are chosen from fixed strings.
function where(options) {
  const terms = options.q.split(' ');
  const values = [(options.position==='beginning'?'':'%')+terms.join('%')+(options.position==='end'?'':'%')];
  const clauses = ['label LIKE $1'];
  const bind = value => { values.push(value); return '$'+values.length; };
  clauses.push(`length(label) BETWEEN ${bind(options.min)} AND ${bind(options.max)}`);
  if(options.tlds.length) clauses.push(`tld = ANY(${bind(options.tlds)}::text[])`);
  for(const word of options.exclude) clauses.push(`label NOT LIKE ${bind('%'+word+'%')}`);
  if(options.omit.includes('digits')) clauses.push("label !~ '[0-9]'");
  if(options.omit.includes('hyphens')) clauses.push("label NOT LIKE '%-%'");
  if(options.omit.includes('idns')) clauses.push("label NOT LIKE 'xn--%'");
  return {sql:clauses.join(' AND '), values, bind};
}
export async function advancedSearch(pool, params) {
  let options;
  try { options = parseResearchParams(params); } catch(error) { throw new SearchError(error.message,400); }
  return transaction(pool, async(client,coverage)=>{
    const snapshot = createHash('sha256').update(JSON.stringify(coverage.zones.map(z=>[z.tld,z.domainCount,z.downloadedAt,z.importedAt]))).digest('hex');
    if(options.snapshot && options.snapshot!==snapshot) throw new SearchError('The index changed between pages. Run the search again to use the new snapshot.',409);
    const missing = options.tlds.filter(tld=>!coverage.zones.some(zone=>zone.tld===tld));
    if(missing.length) throw new SearchError('Coverage is not connected for '+missing.map(t=>'.'+t).join(', ')+'. Remove those extensions to search the current index.',422);
    const exactName = options.q.replaceAll(' ',''), filter=where(options);
    const exactValues=[...filter.values,exactName];
    const suffixes=(await client.query(`SELECT tld FROM domain_index.domains WHERE ${filter.sql} AND label=$${exactValues.length} ORDER BY tld`,exactValues)).rows.map(row=>row.tld);
    let related=[], keywordCount=null, domainCount=null, relatedTotal=null, timedOut=false, relatedMessage;
    if(!options.q.split(' ').some(term=>term.length>=3)) {
      relatedMessage='Use at least one keyword with 3 characters for advanced matching. The exact-name count is shown.';
    } else {
      await client.query('SAVEPOINT advanced_search');
      try {
        await client.query("SET LOCAL statement_timeout = '2500ms'");
        const exact=filter.bind(exactName), limit=filter.bind(PAGE_SIZE), offset=filter.bind((options.page-1)*PAGE_SIZE);
        const order={name:'label ASC',count_desc:'count DESC, label ASC',count_asc:'count ASC, label ASC'}[options.sort];
        // Aggregate the complete filtered relation before ordering or paging.
        // A timeout produces unknown totals, never a partial global ranking.
        const value=(await client.query(`WITH matches AS MATERIALIZED (
          SELECT label, count(*)::int AS count FROM domain_index.domains WHERE ${filter.sql} GROUP BY label
        ), totals AS (
          SELECT count(*)::bigint AS keywords, coalesce(sum(count),0)::bigint AS domains,
            count(*) FILTER (WHERE label <> ${exact})::bigint AS related FROM matches
        ), page AS (
          SELECT label, count FROM matches WHERE label <> ${exact} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}
        ), rows AS (
          SELECT page.label, page.count, array_agg(d.tld ORDER BY d.tld) AS suffixes FROM page
          JOIN domain_index.domains d ON d.label=page.label ${options.tlds.length?'AND d.tld=ANY($4::text[])':''}
          GROUP BY page.label, page.count
        ) SELECT (SELECT row_to_json(totals) FROM totals) AS totals,
          coalesce((SELECT json_agg(r) FROM (SELECT * FROM rows ORDER BY ${order}) r),'[]'::json) AS rows`,filter.values)).rows[0];
        keywordCount=Number(value.totals.keywords); domainCount=Number(value.totals.domains); relatedTotal=Number(value.totals.related);
        related=value.rows.map(row=>({name:row.label,count:row.count,suffixes:row.suffixes}));
        await client.query('RELEASE SAVEPOINT advanced_search');
      } catch(error) {
        await client.query('ROLLBACK TO SAVEPOINT advanced_search');
        if(!['57014','55P03','53400'].includes(error.code)) throw error;
        timedOut=true;
        relatedMessage='This search exceeded its resource budget. Add a longer keyword, select Beginning, or choose fewer extensions. Global totals and ranking are unavailable; the exact-name count is retained.';
      }
    }
    const totalPages=relatedTotal===null?null:Math.max(1,Math.ceil(relatedTotal/PAGE_SIZE));
    return {query:options.q,exactName,position:options.position,source:'czds',total:suffixes.length,suffixes,related,
      relatedPartial:relatedTotal===null || relatedTotal>related.length,
      ...(relatedMessage?{relatedMessage}:{}),fetchedAt:new Date().toISOString(),coverage,
      research:{version:2,options:{...options,snapshot},snapshot,page:options.page,pageSize:PAGE_SIZE,totalPages,
        keywordCount,domainCount,relatedTotal,timedOut,hasNext:totalPages!==null&&options.page<Math.min(totalPages,MAX_PAGE),
        exportScope:'page',pageLimit:MAX_PAGE}};
  });
}
