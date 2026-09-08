// The offline build has no network: every check reports disconnected, so
// callers always take their no-network path (a QR code, never a browser).

export function getNetworkConnected(): boolean {
  return false;
}

export function subscribeNetworkConnected(): () => void {
  return () => {};
}

export async function isNetworkConnected(): Promise<boolean> {
  return false;
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./connectivity.online'),
  typeof import('./connectivity.offline')
>;
