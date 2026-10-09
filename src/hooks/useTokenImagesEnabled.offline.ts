export default function useTokenImagesEnabled(): boolean {
  return false;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./useTokenImagesEnabled.online'),
  typeof import('./useTokenImagesEnabled.offline')
>;
