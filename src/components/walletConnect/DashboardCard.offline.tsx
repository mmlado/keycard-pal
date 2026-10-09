export default function WalletConnectDashboardCard() {
  return null;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./DashboardCard.online'),
  typeof import('./DashboardCard.offline')
>;
