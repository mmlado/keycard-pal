import rawIndex from './token-logos-index.json';

// "chainId:address" -> file extension of the bundled logo, written by
// scripts/generate-logos.js alongside the assets themselves.
export const tokenLogosIndex = rawIndex as Record<string, string>;

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./tokenLogosIndex.online'),
  typeof import('./tokenLogosIndex.offline')
>;
