import { formatUnits } from 'viem';

import { lookupToken } from '@/utils/tokenMetadata';

import type { Eip7730DisplayFormat, Eip7730Field } from './zip';

export type Eip7730FieldContext = {
  chainId?: number;
  contractAddress?: string;
  resolvePath: (path: string) => string | null;
};

function descriptorTokenInfo(
  format: Eip7730DisplayFormat,
  address: string,
): { decimals?: number; ticker?: string } | null {
  const tokens = format.metadata?.tokens;
  if (!tokens) return null;
  return tokens[address.toLowerCase()] ?? tokens['*'] ?? null;
}

function resolveTokenDecimals(
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
  params: Record<string, unknown> | undefined,
): { decimals?: number; symbol?: string; address?: string } {
  let tokenAddress: string | undefined;
  if (params) {
    const tokenPath =
      typeof params.tokenPath === 'string'
        ? params.tokenPath
        : typeof params.token === 'string'
        ? params.token
        : undefined;
    if (tokenPath) {
      const resolved = ctx.resolvePath(tokenPath);
      if (resolved && resolved.startsWith('0x')) tokenAddress = resolved;
    }
  }
  if (!tokenAddress) tokenAddress = ctx.contractAddress;
  if (!tokenAddress) return {};

  const descriptorInfo = descriptorTokenInfo(format, tokenAddress);
  if (descriptorInfo?.decimals !== undefined) {
    return {
      decimals: descriptorInfo.decimals,
      symbol: descriptorInfo.ticker,
      address: tokenAddress,
    };
  }

  const bundled = lookupToken(ctx.chainId, tokenAddress);
  if (bundled) {
    return {
      decimals: bundled.decimals,
      symbol: bundled.symbol,
      address: tokenAddress,
    };
  }
  return { address: tokenAddress };
}

function trimAmount(raw: string): string {
  if (!raw.includes('.')) return raw;
  return raw.replace(/0+$/, '').replace(/\.$/, '');
}

function formatTokenAmountValue(
  value: string,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
  params: Record<string, unknown> | undefined,
): string {
  let amount: bigint;
  try {
    amount = BigInt(value);
  } catch {
    return value;
  }
  const info = resolveTokenDecimals(format, ctx, params);
  if (info.decimals === undefined) return value;
  const formatted = trimAmount(formatUnits(amount, info.decimals));
  return info.symbol ? `${formatted} ${info.symbol}` : formatted;
}

function formatDateValue(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return value;
  try {
    return new Date(num * 1000).toLocaleString();
  } catch {
    return value;
  }
}

function formatEnumValue(
  value: string,
  format: Eip7730DisplayFormat,
  params: Record<string, unknown> | undefined,
): string {
  const enumId =
    params && typeof params.$ref === 'string'
      ? params.$ref
      : params && typeof params.enumId === 'string'
      ? params.enumId
      : undefined;
  if (!enumId) return value;
  const map = format.metadata?.enums?.[enumId];
  if (!map) return value;
  return map[value] ?? value;
}

export function formatEip7730Field(
  field: Eip7730Field,
  value: string | null,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): string {
  if (value === null) return '—';
  switch (field.format) {
    case 'tokenAmount':
      return formatTokenAmountValue(value, format, ctx, field.params);
    case 'date':
      return formatDateValue(value);
    case 'enum':
      return formatEnumValue(value, format, field.params);
    case 'addressName':
    case 'raw':
    case 'calldata':
    default:
      return value;
  }
}
