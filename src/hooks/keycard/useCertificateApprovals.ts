import { useCallback, useEffect, useRef } from 'react';

import {
  approveCardKey,
  loadApprovedCardKeys,
} from '@/storage/approvedCardsStorage';
import { fromHex } from '@/utils/hex';

export interface UseCertificateApprovals {
  /** For the session's `whitelistedCardKeys` option. */
  whitelistedCardKeys: () => Promise<Uint8Array[]>;
  /** The user accepted this card. In force from the next tap, not yet kept. */
  approve: (cardKey: string) => void;
  /** The secure channel opened with this card. Keeps a waiting approval. */
  handshakeSucceeded: (cardKey: string) => void;
}

/**
 * Approvals of cards with an untrusted certificate (ADR-0013), in two stages: `approve` whitelists
 * in memory for the next tap, `handshakeSucceeded` writes to storage, because only the handshake
 * proves the card holds its key.
 */
export function useCertificateApprovals(): UseCertificateApprovals {
  const unprovenRef = useRef<Set<string>>(new Set());

  // Warm the store before any tap, so a tap only reads memory.
  useEffect(() => {
    loadApprovedCardKeys().catch(() => {});
  }, []);

  const whitelistedCardKeys = useCallback(async () => {
    const remembered = await loadApprovedCardKeys();
    return [...new Set([...remembered, ...unprovenRef.current])].map(fromHex);
  }, []);

  const approve = useCallback((cardKey: string) => {
    unprovenRef.current.add(cardKey);
  }, []);

  const handshakeSucceeded = useCallback((cardKey: string) => {
    if (!unprovenRef.current.has(cardKey)) {
      return;
    }
    // Not awaited: the write must not hold the card on the antenna.
    approveCardKey(cardKey)
      .then(() => unprovenRef.current.delete(cardKey))
      .catch(e => console.warn('[Keycard] approval not saved', e));
  }, []);

  return { whitelistedCardKeys, approve, handshakeSucceeded };
}
