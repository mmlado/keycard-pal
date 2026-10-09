export default function WalletConnectSettingsSection() {
  return null;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./WalletConnectSettingsSection.online'),
  typeof import('./WalletConnectSettingsSection.offline')
>;
