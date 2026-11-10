import { getAddress } from 'viem';

/** Token metadata the user entered. The address is lowercase. */
export type CustomToken = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
};

const MAX_SYMBOL_LENGTH = 20;
const MAX_DECIMALS = 255;

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Printable ASCII without the space: a look-alike symbol then cannot pass the duplicate check.
const SYMBOL_RE = /^[\x21-\x7e]+$/;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

export function parseChainId(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export type AddressProblem = 'format' | 'checksum' | 'zero';

/** All lowercase and all uppercase carry no checksum; mixed case must be EIP-55. */
export function addressProblem(text: string): AddressProblem | null {
  if (!HEX_ADDRESS_RE.test(text)) return 'format';
  const hex = text.slice(2);
  const mixed = hex !== hex.toLowerCase() && hex !== hex.toUpperCase();
  if (mixed && getAddress(text) !== text) return 'checksum';
  return text.toLowerCase() === ZERO_ADDRESS ? 'zero' : null;
}

export function isValidSymbol(text: string): boolean {
  return (
    text.length >= 1 && text.length <= MAX_SYMBOL_LENGTH && SYMBOL_RE.test(text)
  );
}

export function parseDecimals(text: string): number | null {
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n <= MAX_DECIMALS ? n : null;
}

function isCustomToken(value: unknown): value is CustomToken {
  if (typeof value !== 'object' || value === null) return false;
  const { chainId, address, symbol, decimals } = value as CustomToken;
  return (
    typeof chainId === 'number' &&
    parseChainId(String(chainId)) === chainId &&
    typeof address === 'string' &&
    address === address.toLowerCase() &&
    addressProblem(address) === null &&
    typeof symbol === 'string' &&
    isValidSymbol(symbol) &&
    typeof decimals === 'number' &&
    parseDecimals(String(decimals)) === decimals
  );
}

export const sameToken = (
  token: CustomToken,
  chainId: number,
  address: string,
): boolean =>
  token.chainId === chainId && token.address === address.toLowerCase();

/** Every entry the editor would accept, the first of each chain and address. */
export function readCustomTokens(stored: unknown): CustomToken[] {
  if (!Array.isArray(stored)) return [];
  const tokens: CustomToken[] = [];
  for (const entry of stored) {
    if (
      isCustomToken(entry) &&
      !tokens.some(t => sameToken(t, entry.chainId, entry.address))
    ) {
      const { chainId, address, symbol, decimals } = entry;
      tokens.push({ chainId, address, symbol, decimals });
    }
  }
  return tokens;
}

// The lookup runs inside display code that cannot wait, so the list lives in memory.
let tokens: readonly CustomToken[] = [];
const listeners = new Set<() => void>();

/** Only the storage module calls this, after storage holds the list. */
export function setCustomTokens(next: readonly CustomToken[]): void {
  tokens = next;
  listeners.forEach(listener => listener());
}

export function getCustomTokens(): readonly CustomToken[] {
  return tokens;
}

export function subscribeCustomTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function findCustomToken(
  chainId: number,
  address: string,
): CustomToken | null {
  return tokens.find(t => sameToken(t, chainId, address)) ?? null;
}
