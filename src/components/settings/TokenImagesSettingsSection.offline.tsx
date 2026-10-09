import React from 'react';

export default function TokenImagesSettingsSection(): React.JSX.Element | null {
  return null;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./TokenImagesSettingsSection.online'),
  typeof import('./TokenImagesSettingsSection.offline')
>;
