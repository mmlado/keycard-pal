import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * The cards the user has approved even though their certificate chains to no
 * trusted CA (ADR-0013). Keyed on the card key, which on such a card is the
 * identity public key from its certificate.
 *
 * This is the one deliberate exception to the app remembering nothing about a
 * card. Without it a custom or development card would raise the warning on
 * every single tap, where a 3.x card asks once and is then carried by its
 * pairing record.
 *
 * An entry is written only after the secure channel handshake has proven the
 * card holds the certificate's private key. Anyone can present a copied
 * certificate; only the real card can sign the handshake.
 *
 * Encrypted storage for the same reason pairings use it: what matters here is
 * that nothing else on the device can add an entry.
 */
const STORAGE_KEY = 'approved_card_keys';

const CARD_KEY = /^[0-9a-f]+$/;

let cache: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (cache) {
    return cache;
  }
  let stored: unknown = null;
  try {
    const value = await EncryptedStorage.getItem(STORAGE_KEY);
    stored = value ? JSON.parse(value) : null;
  } catch {
    // Unreadable storage approves nothing: the user is simply asked again.
  }
  const keys = Array.isArray(stored)
    ? stored.filter(
        (key): key is string => typeof key === 'string' && CARD_KEY.test(key),
      )
    : [];
  cache = new Set(keys);
  return cache;
}

/** Every approved card key, as lowercase hex. Never rejects. */
export async function loadApprovedCardKeys(): Promise<string[]> {
  return [...(await load())];
}

/**
 * Remembers an approval. Call it only once the handshake with that card has
 * succeeded. Rejects when storage does; the approval then lasts for as long as
 * the caller keeps it in memory, and the user is asked again next time.
 */
export async function approveCardKey(cardKey: string): Promise<void> {
  const keys = await load();
  if (keys.has(cardKey)) {
    return;
  }
  const next = new Set(keys).add(cardKey);
  await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  cache = next;
}

/** Drops the in-memory copy, so the next read goes back to storage. Tests only. */
export function resetApprovedCardKeysCache(): void {
  cache = null;
}
