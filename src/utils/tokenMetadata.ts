import { formatUnits } from 'viem';

import { tokenLogosIndex } from '@/data/tokenLogosIndex.online';
import tokensData from '@/data/tokens.json';

export type TokenMetadata = {
  symbol: string;
  decimals: number;
  logoURI?: string;
};

type RawToken = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

const tokenMap = new Map<string, TokenMetadata>();

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
}

export function lookupToken(
  chainId: number | undefined,
  address: string | undefined,
): TokenMetadata | null {
  if (chainId == null || !address) return null;
  return tokenMap.get(`${chainId}:${address.toLowerCase()}`) ?? null;
}

export function formatTokenAmount(
  amount: bigint,
  token: TokenMetadata,
): string {
  const raw = formatUnits(amount, token.decimals);
  const num = parseFloat(raw);
  if (num === 0) return `0 ${token.symbol}`;
  const str =
    num >= 1
      ? num.toLocaleString('en-US', { maximumFractionDigits: 4 })
      : num.toPrecision(4).replace(/\.?0+$/, '');
  return `${str} ${token.symbol}`;
}
