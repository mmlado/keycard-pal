import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getCustomTokens,
  readCustomTokens,
  sameToken,
  setCustomTokens,
  type CustomToken,
} from '@/utils/customTokens';

const KEY = 'custom_tokens';

let writes: Promise<void> = Promise.resolve();

/** Once at startup. Never rejects: an unreadable list is an empty one. */
export async function restoreCustomTokens(): Promise<void> {
  let stored: unknown = null;
  try {
    const text = await AsyncStorage.getItem(KEY);
    stored = text === null ? null : JSON.parse(text);
  } catch {}
  setCustomTokens(readCustomTokens(stored));
}

// One write at a time, each built on the list the previous one left.
function write(
  change: (current: readonly CustomToken[]) => CustomToken[],
): Promise<void> {
  const next = writes.then(async () => {
    const updated = change(getCustomTokens());
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    setCustomTokens(updated);
  });
  writes = next.catch(() => {});
  return next;
}

/** Adds the token, or replaces the one at its chain and address. Rejects when storage does, leaving the list as it was. */
export function saveCustomToken(token: CustomToken): Promise<void> {
  const entry = { ...token, address: token.address.toLowerCase() };
  return write(current => {
    const at = current.findIndex(t =>
      sameToken(t, entry.chainId, entry.address),
    );
    return at < 0
      ? [...current, entry]
      : current.map((t, i) => (i === at ? entry : t));
  });
}

/** Rejects when storage does, leaving the list as it was. */
export function deleteCustomToken(
  chainId: number,
  address: string,
): Promise<void> {
  return write(current => current.filter(t => !sameToken(t, chainId, address)));
}
