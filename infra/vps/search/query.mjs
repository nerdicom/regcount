// Shared, environment-independent validation for the browser and private API.
export const PAGE_SIZE = 50;
export const MAX_PAGE = 100;
const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** @typedef {{q:string, position:'any'|'beginning'|'end', sort:'name'|'count_desc'|'count_asc', min:number, max:number, tlds:string[], exclude:string[], omit:string[], page:number, snapshot:string}} ResearchOptions */
/** @param {URLSearchParams} params @returns {ResearchOptions} */
export function parseResearchParams(params) {
  const keys = ['q','position','sort','min','max','tlds','exclude','omit','page','snapshot'];
  if ([...params.keys()].some(key => !keys.includes(key) || params.getAll(key).length !== 1)) throw Error('Unknown or repeated search option.');
  const q = (params.get('q') || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const terms = q.split(' ');
  if (!q || q.length > 100 || terms.length > 5 || terms.some(term => !label.test(term)) || terms.join('').length > 63) throw Error('Use up to 5 keywords with letters, numbers or hyphens, totalling at most 63 characters.');
  const position = params.get('position') || 'any';
  const sort = params.get('sort') || 'name';
  if (!['any','beginning','end'].includes(position)) throw Error('Choose Any position, Beginning, or End.');
  if (!['name','count_desc','count_asc'].includes(sort)) throw Error('Choose a supported sort order.');
  /** @param {string} key @param {number} fallback @param {number} limit */
  function number(key, fallback, limit) {
    const raw = params.get(key);
    if (raw === null || raw === '') return fallback;
    if (!/^\d{1,3}$/.test(raw) || Number(raw) < 1 || Number(raw) > limit) throw Error(`Invalid ${key} value.`);
    return Number(raw);
  }
  const min = number('min',1,63), max = number('max',63,63), page = number('page',1,MAX_PAGE);
  if (min > max) throw Error('Minimum length must not exceed maximum length.');
  /** @param {string} key */
  function list(key) { return [...new Set((params.get(key)||'').toLowerCase().split(/[\s,]+/).filter(Boolean))]; }
  const tlds = list('tlds').map(tld=>tld.replace(/^\./,''));
  const exclude = list('exclude'), omit = list('omit');
  if (tlds.length > 30 || tlds.some(tld=>!label.test(tld)) || new Set(tlds).size !== tlds.length) throw Error('Choose up to 30 unique extensions, such as com, org, dev.');
  if (exclude.length > 5 || exclude.some(word=>!label.test(word))) throw Error('Use up to 5 excluded words.');
  if (omit.some(value=>!['digits','hyphens','idns'].includes(value))) throw Error('Invalid character filter.');
  const snapshot = params.get('snapshot') || '';
  if (snapshot && !/^[a-f0-9]{64}$/.test(snapshot)) throw Error('Invalid snapshot. Run the search again.');
  if (page > 1 && !snapshot) throw Error('Run the first page before requesting another page.');
  return {q, position:/** @type {ResearchOptions['position']} */(position), sort:/** @type {ResearchOptions['sort']} */(sort), min, max, tlds:tlds.sort(), exclude:exclude.sort(), omit:omit.sort(), page, snapshot};
}
/** @param {ResearchOptions} options */
export function researchParams(options) {
  return new URLSearchParams({q:options.q, position:options.position, sort:options.sort, min:String(options.min), max:String(options.max), tlds:options.tlds.join(','), exclude:options.exclude.join(','), omit:options.omit.join(','), page:String(options.page), ...(options.snapshot?{snapshot:options.snapshot}:{})});
}
/** @param {string} name @param {ResearchOptions} options */
export function matchesResearchName(name, options) {
  const terms = options.q.split(' ');
  const pattern = new RegExp(`${options.position==='beginning'?'^':''}${terms.join('.*')}${options.position==='end'?'$':''}`);
  return pattern.test(name) && name.length >= options.min && name.length <= options.max && !options.exclude.some(word=>name.includes(word)) &&
    !(options.omit.includes('digits')&&/\d/.test(name)) && !(options.omit.includes('hyphens')&&name.includes('-')) && !(options.omit.includes('idns')&&name.startsWith('xn--'));
}
