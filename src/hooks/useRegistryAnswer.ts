import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { getSavedIndex, subscribeSavedIndex } from '@/utils/eip7730/lookup';

type Settled<T> = { from: Promise<T>; answer: T };

/** `ask` must be stable (useCallback); `loading` holds while a saved slice is read. */
export function useRegistryAnswer<T>(ask: () => T | Promise<T>): {
  answer: T | null;
  loading: boolean;
} {
  // Asks again when an import, a download or the reset changes the source.
  const saved = useSyncExternalStore(subscribeSavedIndex, getSavedIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => ask(), [ask, saved]);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!(result instanceof Promise)) return;
    let current = true;
    result.then(answer => {
      if (current) setSettled({ from: result, answer });
    });
    return () => {
      current = false;
    };
  }, [result]);

  if (!(result instanceof Promise)) return { answer: result, loading: false };
  return settled?.from === result
    ? { answer: settled.answer, loading: false }
    : { answer: null, loading: true };
}
