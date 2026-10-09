export type ResolveEnsNameResult =
  | { name: string }
  | { name: null; reason: 'not-found' | 'mismatch' | 'rpc-error' };

export async function resolveEnsName(
  _address: string,
  _rpcUrl: string,
): Promise<ResolveEnsNameResult> {
  return { name: null, reason: 'not-found' };
}

export async function validateRpcUrl(
  _url: string,
): Promise<'ok' | 'non-mainnet' | 'timeout' | 'unreachable'> {
  return 'unreachable';
}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./client.online'),
  typeof import('./client.offline')
>;
