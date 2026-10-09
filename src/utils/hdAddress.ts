import { HDKey } from '@scure/bip32';

// Account-level derivation paths exported from the Keycard per coin.
export const ACCOUNT_PATHS = {
  eth: "m/44'/60'/0'",
  btc: "m/84'/0'/0'",
} as const;

// Derive `count` child public keys at path .../0/0, .../0/1, ...
// addrFn converts a compressed pubkey to a coin-specific address string.
export function deriveAddresses(
  externalKey: HDKey, // already the /0 child
  count: number,
  addrFn: (pubKey: Uint8Array) => string,
  startIndex = 0,
): string[] {
  return Array.from({ length: count }, (_, i) =>
    addrFn(externalKey.deriveChild(startIndex + i).publicKey!),
  );
}
