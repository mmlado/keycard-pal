import { formatUnits } from 'viem';

import { tokenLogosIndex } from '@/data/tokenLogosIndex.online';
import tokensData from '@/data/tokens.json';

import { findCustomToken } from '@/utils/customTokens';

export type TokenMetadata = {
  symbol: string;
  decimals: number;
  logoURI?: string;
  /** Entered by the user, reviewed by nobody else. */
  custom?: true;
};

type RawToken = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

const tokenMap = new Map<string, TokenMetadata>();
const symbolsByChain = new Set<string>();

const symbolKey = (chainId: number, symbol: string) =>
  `${chainId}:${symbol.toLowerCase()}`;

for (const token of (tokensData as { tokens: RawToken[] }).tokens) {
  const key = `${token.chainId}:${token.address}`;
  const ext = tokenLogosIndex[key];
  const localLogoURI = ext
    ? `asset:/token-logos/${token.chainId}-${token.address}.${ext}`
    : undefined;
  tokenMap.set(key, {
    symbol: token.symbol,
    decimals: token.decimals,
    logoURI: localLogoURI ?? token.logoURI,
  });
  symbolsByChain.add(symbolKey(token.chainId, token.symbol));
}

export function lookupBundledToken(
  chainId: number | undefined,
  address: string | undefined,
): TokenMetadata | null {
  if (chainId == null || !address) return null;
  return tokenMap.get(`${chainId}:${address.toLowerCase()}`) ?? null;
}

/** The bundled list first; a custom token only fills a gap. */
export function lookupToken(
  chainId: number | undefined,
  address: string | undefined,
): TokenMetadata | null {
  const bundled = lookupBundledToken(chainId, address);
  if (bundled || chainId == null || !address) return bundled;
  const custom = findCustomToken(chainId, address);
  return custom
    ? { symbol: custom.symbol, decimals: custom.decimals, custom: true }
    : null;
}

/** Case-insensitive. */
export function bundledSymbolOnChain(chainId: number, symbol: string): boolean {
  return symbolsByChain.has(symbolKey(chainId, symbol));
}

/** A decimal without trailing zeros. */
export function trimDecimal(raw: string): string {
  if (!raw.includes('.')) return raw;
  return raw.replace(/0+$/, '').replace(/\.$/, '');
}

/** Exact: a review must not round what is signed. */
export function formatTokenAmount(
  amount: bigint,
  token: Pick<TokenMetadata, 'symbol' | 'decimals'>,
): string {
  return `${trimDecimal(formatUnits(amount, token.decimals))} ${token.symbol}`;
}
