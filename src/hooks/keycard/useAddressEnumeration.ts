import { HDKey } from '@scure/bip32';
import Keycard from 'keycard-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deriveAddresses } from '@/utils/hdAddress';

import { useKeycardOp } from './useKeycardOperation';

/** One enumerated address with the derivation path it came from. The pair is
 *  built from the same child key, so the address shown is always the address
 *  this path derives. */
export type AddressRow = {
  address: string;
  path: string;
};

export type UseAddressEnumerationOptions = {
  /** Derive addresses at accountPath/0/i (true, BIP44 external chain) or accountPath/i (false, e.g. Ledger Legacy). */
  hasExternalChain?: boolean;
  batchSize?: number;
};

/**
 * Enumerate addresses under an account-level path: exports the account xpub
 * over NFC, derives address batches off the UI thread, and returns rows of
 * { address, path } so the two facts travel together. Consumers render rows
 * and hand row.path to whatever needs it (navigation, approveSession) —
 * never recover the path from a list index.
 */
export function useAddressEnumeration(
  accountPath: string,
  addressFn: (pubKey: Uint8Array) => string,
  options: UseAddressEnumerationOptions = {},
) {
  const { hasExternalChain = true, batchSize = 20 } = options;

  const [rows, setRows] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const enumerationKeyRef = useRef<HDKey | null>(null);
  const nextIndexRef = useRef(0);
  const loadingRef = useRef(false);

  const nfc = useKeycardOp<HDKey>(
    useCallback(
      async cmdSet => {
        const resp = await cmdSet.exportExtendedKey(0, accountPath, false);
        resp.checkOK();
        return Keycard.BIP32KeyPair.extendedKey(resp.data);
      },
      [accountPath],
    ),
    // Read-only xpub export: safe to re-run from SELECT on a re-tap.
    { requiresPin: true, retryOnTagLoss: true },
  );
  const { phase, result } = nfc;

  const deriveBatch = useCallback(
    (key: HDKey, from: number): AddressRow[] =>
      deriveAddresses(key, batchSize, addressFn, from).map((address, i) => ({
        address,
        path: hasExternalChain
          ? `${accountPath}/0/${from + i}`
          : `${accountPath}/${from + i}`,
      })),
    [accountPath, addressFn, batchSize, hasExternalChain],
  );

  const loadMore = useCallback(() => {
    const key = enumerationKeyRef.current;
    if (!key || loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    const from = nextIndexRef.current;
    nextIndexRef.current = from + batchSize;
    // Yield to the UI before the (CPU-heavy) child-key derivation.
    setTimeout(() => {
      const batch = deriveBatch(key, from);
      setRows(prev => [...prev, ...batch]);
      loadingRef.current = false;
      setLoading(false);
    }, 0);
  }, [batchSize, deriveBatch]);

  useEffect(() => {
    if (phase !== 'done' || !result) {
      return;
    }
    enumerationKeyRef.current = hasExternalChain
      ? result.deriveChild(0)
      : result;
    nextIndexRef.current = 0;
    loadingRef.current = false;
    setRows([]);
    loadMore();
  }, [phase, result, hasExternalChain, loadMore]);

  return { rows, loading, loadMore, nfc };
}
