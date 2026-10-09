import type { TenderlyCredentials } from '@/storage/tenderly.offline';

export type { TenderlyCredentials };

export function useTenderlyConfig(): {
  credentials: TenderlyCredentials | null;
} {
  return { credentials: null };
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./useTenderlyConfig.online'),
  typeof import('./useTenderlyConfig.offline')
>;
