export type ResolveEnsNameResult =
  | { name: string }
  | { name: null; reason: 'not-found' | 'mismatch' | 'rpc-error' };

export async function resolveEnsName(
  _address: string,
  _rpcUrl: string,
): Promise<ResolveEnsNameResult> {
  return { name: null, reason: 'not-found' };
}
