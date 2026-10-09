import AddressText from '../AddressText';

export default function EnsAddressLabel({ address }: { address: string }) {
  return <AddressText address={address} />;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./EnsAddressLabel.online'),
  typeof import('./EnsAddressLabel.offline')
>;
