import bundledIndex from '@/data/eip7730.json';

import type { Eip7730DisplayFormat, Eip7730Index } from './zip';

let runtimeIndex: Eip7730Index | null = null;

export function setRuntimeIndex(index: Eip7730Index | null): void {
  runtimeIndex = index;
}

export function getActiveIndex(): Eip7730Index {
  return runtimeIndex ?? (bundledIndex as unknown as Eip7730Index);
}

function indexKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function lookupCalldata(
  chainId: number,
  contractAddress: string,
  selector: string,
): Eip7730DisplayFormat | null {
  if (!Number.isFinite(chainId) || !contractAddress || !selector) return null;
  const key = indexKey(chainId, contractAddress);
  return getActiveIndex().contracts[key]?.[selector.toLowerCase()] ?? null;
}

export function lookupEip712(
  chainId: number,
  verifyingContract: string,
  primaryType: string,
): Eip7730DisplayFormat | null {
  if (!Number.isFinite(chainId) || !verifyingContract || !primaryType)
    return null;
  const key = indexKey(chainId, verifyingContract);
  return getActiveIndex().eip712[key]?.[primaryType] ?? null;
}
