import InfoRow from '../InfoRow';

export default function AddressInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <InfoRow label={label} value={value} />;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./AddressInfoRow.online'),
  typeof import('./AddressInfoRow.offline')
>;
