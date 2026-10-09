import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * Card keys the user approved although the certificate chains to no trusted CA (ADR-0013). The one
 * thing the app remembers about a card. Written only after the handshake has proven the card
 * holds its key. Encrypted, so nothing else on the device can add an entry.
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

/** Call only after a successful handshake. Rejects when storage does; the user is then asked again. */
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
