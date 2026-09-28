'use client';
import { useEffect, useState } from 'react';
import { LIVE_EXACT_SUFFIXES, validLiveResult, type LiveExtensionResult } from '@/lib/live-extensions';
export function useLiveExtensions(query: string, covered: string[], enabled: boolean) {
  const excluded = covered.filter(suffix => (LIVE_EXACT_SUFFIXES as readonly string[]).includes(suffix)).sort().join(',');
  const key = `${query}:${excluded}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; attempt: number; data: LiveExtensionResult | null; error: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/live-extensions?${new URLSearchParams({ q: query, exclude: excluded })}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(23000)]), cache: 'no-store',
        });
        const data: unknown = await response.json();
        if (!response.ok || !validLiveResult(data, query)) throw Error('Live checks could not finish. Your indexed results are still available.');
        if (!controller.signal.aborted) setState({ key, attempt, data, error: '' });
      } catch {
        if (!controller.signal.aborted) setState({ key, attempt, data: null, error: 'Live checks could not finish. Your indexed results are still available.' });
      }
    })();
    return () => controller.abort();
  }, [query, excluded, key, enabled, attempt]);
  const current = enabled && state?.key === key && state.attempt === attempt ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? '', loading: enabled && !current, retry: () => setAttempt(n => n + 1) };
}
