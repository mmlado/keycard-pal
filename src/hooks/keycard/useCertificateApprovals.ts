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
 * The user's approvals of cards whose certificate chains to no trusted CA
 * (ADR-0013), for a hook that opens a secure channel with such cards.
 *
 * An approval lives in two stages on purpose. `approve` only puts the card on
 * the whitelist, in memory, which is what gets it through SELECT on the next
 * tap. It is written to storage by `handshakeSucceeded`, because only the
 * handshake shows the card holds the certificate's private key: anyone can
 * present a copied certificate, only the real card can sign with it.
 * keycard-shell stores first and opens the channel second, so there a card
 * that cannot back its certificate still leaves a permanent entry behind.
 */
export function useCertificateApprovals(): UseCertificateApprovals {
  const unprovenRef = useRef<Set<string>>(new Set());

  // Warm the store before any tap, so reading it during one is a lookup in
  // memory and adds nothing to the time the card spends on the antenna.
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
    // Not awaited: the write has no business holding the card on the antenna,
    // and until it lands the approval is still in force from memory.
    approveCardKey(cardKey)
      .then(() => unprovenRef.current.delete(cardKey))
      .catch(e => console.warn('[Keycard] approval not saved', e));
  }, []);

  return { whitelistedCardKeys, approve, handshakeSucceeded };
}
