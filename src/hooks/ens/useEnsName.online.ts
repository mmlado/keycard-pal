import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';

import { loadEnsRpcUrl } from '../../storage/ensSettings.online';
import { resolveEnsName } from '../../utils/ens/client.online';

const cache = new Map<string, string>();

export interface UseEnsNameResult {
  name: string | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

function normalizeAddress(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

export function useEnsName(address: string): UseEnsNameResult {
  const normalized = normalizeAddress(address);

  const [name, setName] = useState<string | null>(() => {
    if (!normalized) return null;
    return cache.get(normalized) ?? null;
  });
  const [loading, setLoading] = useState(() => {
    if (!normalized) return false;
    return !cache.has(normalized);
  });
  const [error, setError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const lastFailureRef = useRef<'rpc-error' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!normalized) {
        setName(null);
        setLoading(false);
        setError(false);
        lastFailureRef.current = null;
        return;
      }

      if (cache.has(normalized)) {
        setName(cache.get(normalized)!);
        setLoading(false);
        setError(false);
        lastFailureRef.current = null;
        return;
      }

      setLoading(true);
      setError(false);
      lastFailureRef.current = null;

      const rpcUrl = await loadEnsRpcUrl();
      if (!rpcUrl) {
        if (!cancelled) {
          setLoading(false);
          setName(null);
          setError(false);
        }
        return;
      }

      const result = await resolveEnsName(normalized, rpcUrl);
      if (cancelled) return;

      if ('name' in result && result.name !== null) {
        cache.set(normalized, result.name);
        setName(result.name);
        setLoading(false);
        setError(false);
        lastFailureRef.current = null;
      } else if (result.reason === 'rpc-error') {
        setName(null);
        setLoading(false);
        setError(true);
        lastFailureRef.current = 'rpc-error';
      } else {
        cache.set(normalized, '');
        setName('');
        setLoading(false);
        setError(false);
        lastFailureRef.current = null;
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [normalized, retryTrigger]);

  const retry = useCallback(() => {
    if (!normalized) return;
    if (lastFailureRef.current !== 'rpc-error') return;
    setRetryTrigger(t => t + 1);
  }, [normalized]);

  return { name, loading, error, retry };
}

export function clearEnsNameCache(): void {
  cache.clear();
}
