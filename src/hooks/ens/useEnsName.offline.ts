export interface UseEnsNameResult {
  name: string | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

function noop() {}

export function useEnsName(_address: string): UseEnsNameResult {
  return { name: null, loading: false, error: false, retry: noop };
}

export function clearEnsNameCache(): void {}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./useEnsName.online'),
  typeof import('./useEnsName.offline')
>;
