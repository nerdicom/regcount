// Exact-name checks only. These suffixes are not a bulk registration index.
export const LIVE_EXACT_SUFFIXES = [
  'com', 'net', 'ai', 'si', 'io', 'so', 'de', 'co.uk', 'cn', 'ru', 'top', 'name',
  'co', 'uk', 'me', 'us', 'fr', 'ca', 'com.au', 'nl', 'ch', 'it', 'es', 'eu',
  'in', 'jp', 'tv', 'cc', 'be', 'se', 'pl', 'co.nz',
] as const;
export type LiveExtensionObservation = {
  suffix: string;
  status: 'confirmed' | 'not-confirmed' | 'unavailable';
  checkedAt: string;
};
export type LiveExtensionResult = {
  query: string;
  source: 'google-public-dns';
  basis: 'exact-name-ns';
  observations: LiveExtensionObservation[];
};

export function additionalLiveSuffixes(indexed: string[], covered: string[], data: LiveExtensionResult | null) {
  return [...new Set(data?.observations.filter(row => row.status === 'confirmed'
    && !indexed.includes(row.suffix) && !covered.includes(row.suffix)).map(row => row.suffix) ?? [])];
}

export function validLiveResult(value: unknown, query: string): value is LiveExtensionResult {
  if (!value || typeof value !== 'object') return false;
  const data = value as LiveExtensionResult;
  return data.query === query && data.source === 'google-public-dns' && data.basis === 'exact-name-ns'
    && Array.isArray(data.observations) && data.observations.length <= LIVE_EXACT_SUFFIXES.length
    && data.observations.every(row => row && (LIVE_EXACT_SUFFIXES as readonly string[]).includes(row.suffix)
      && ['confirmed', 'not-confirmed', 'unavailable'].includes(row.status)
      && typeof row.checkedAt === 'string' && Number.isFinite(Date.parse(row.checkedAt)))
    && new Set(data.observations.map(row => row.suffix)).size === data.observations.length;
}
