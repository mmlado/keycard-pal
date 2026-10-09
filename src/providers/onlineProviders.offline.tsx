import React from 'react';

export function OnlineProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./onlineProviders.online'),
  typeof import('./onlineProviders.offline')
>;
