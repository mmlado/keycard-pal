import type { LicenseEntry } from './licenses';

export const onlineLicenses: LicenseEntry[] = [];

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./onlineLicenses.online'),
  typeof import('./onlineLicenses.offline')
>;
