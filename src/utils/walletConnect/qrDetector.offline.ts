export async function refreshWcDetection(): Promise<void> {}

export function detectWcUri(_value: string, _navigation: unknown): boolean {
  return false;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./qrDetector.online'),
  typeof import('./qrDetector.offline')
>;
