import { formatUnits, keccak256 } from 'viem';

import { UNLIMITED_APPROVAL_WARNING } from '@/constants/approval';

import { getChainName, getNativeCurrencySymbol } from '@/utils/chainMetadata';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import { rfc3339 } from '@/utils/rfc3339';
import { lookupToken, type TokenMetadata } from '@/utils/tokenMetadata';

import { arrayIndices, bindField, firstArraySelector } from './arrays';
import {
  interpolationParts,
  isDecimals,
  normalizeFieldPath,
  type Eip7730DisplayFormat,
  type Eip7730Field,
} from './zip';

export type Eip7730FieldContext = {
  chainId?: number;
  contractAddress?: string;
  resolvePath: (path: string) => string | null;
  /** Every value a path selects, for fields over arrays. */
  resolveEach?: (path: string) => string[];
};

export type Eip7730FieldDisplay = {
  text: string;
  warnings?: string[];
  unknownTokenAddress?: string;
  /** The ciphertext or its handle, shown beside the placeholder. */
  encryptedValue?: string;
};

export const UNKNOWN_TOKEN_WARNING = 'Unknown token';
export const NOT_SIGNER_WARNING =
  'This is not the address signing this request.';
export const SENDER_TEXT = 'Sender';
export const ENCRYPTED_TEXT = '[Encrypted]';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const WORD_RE = /^0x[0-9a-fA-F]{64}$/;
const ENUM_REF_PREFIX = '$.metadata.enums.';
const NATIVE_DECIMALS = 18;
// Spending permissions; "All" and "Max" withdraw the user's own funds.
const UNLIMITED_MESSAGES = new Set(['Unlimited', 'Any amount']);

type Params = Record<string, unknown> | undefined;
type TokenInfo = { decimals: number; symbol: string };

function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function literalAddresses(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((v): v is string => typeof v === 'string' && ADDRESS_RE.test(v))
    .map(v => v.toLowerCase());
}

/** An address, or the last 20 bytes of a 32-byte word, where the ABI puts one. */
export function asAddress(value: string): string | null {
  if (ADDRESS_RE.test(value)) return checksumEthAddress(value);
  if (WORD_RE.test(value)) return checksumEthAddress(`0x${value.slice(-40)}`);
  if (!/^\d+$/.test(value)) return null;
  const n = BigInt(value);
  return n < 2n ** 256n
    ? checksumEthAddress(`0x${n.toString(16).padStart(64, '0').slice(-40)}`)
    : null;
}

export type AddressNameDisplay = {
  /** Null only for a sender the request does not name. */
  address: string | null;
  sender: boolean;
  token: TokenMetadata | null;
  warnings: string[];
  ens: boolean;
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/** What an addressName field can say offline; null when the value is no address. */
export function describeAddress(
  field: Eip7730Field,
  raw: string,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): AddressNameDisplay | null {
  const address = asAddress(raw);
  if (!address) return null;
  const params = field.params;
  const types = strings(params?.types);
  // The spec allows only the listed sources to name an address.
  const ens =
    !Array.isArray(params?.sources) || strings(params.sources).includes('ens');
  const from = ctx.resolvePath('@.from');
  const signer = from ? asAddress(from) : null;
  const lower = address.toLowerCase();
  if (literalAddresses(params?.senderAddress).includes(lower)) {
    return { address: signer, sender: true, token: null, warnings: [], ens };
  }
  const warnings: string[] = [];
  let token: TokenMetadata | null = null;
  if (types.includes('token')) {
    token = knownToken(format, ctx, params, lower);
    if (!token && types.length === 1) warnings.push(UNKNOWN_TOKEN_WARNING);
  }
  if (
    types.length === 1 &&
    types[0] === 'wallet' &&
    signer !== null &&
    signer !== address
  ) {
    warnings.push(NOT_SIGNER_WARNING);
  }
  return { address, sender: false, token, warnings, ens };
}

function encryptedLabel(field: Eip7730Field): string | null {
  return field.encryption
    ? field.encryption.fallbackLabel ?? ENCRYPTED_TEXT
    : null;
}

/** An ERC-7930 address on an EVM chain as ERC-7828 writes it; null for anything else. */
export function interoperableName(
  raw: string,
): { text: string; address: string; chainId: number } | null {
  if (!/^0x([0-9a-f]{2})*$/i.test(raw)) return null;
  const hex = raw.slice(2).toLowerCase();
  const byte = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const size = hex.length / 2;
  if (size < 6 || byte(0) * 256 + byte(1) !== 1) return null;
  const chainType = byte(2) * 256 + byte(3);
  const referenceLength = byte(4);
  if (6 + referenceLength > size) return null;
  const addressLength = byte(5 + referenceLength);
  if (6 + referenceLength + addressLength !== size) return null;
  // Only eip155 (0x0000) has a display rule the app knows: a chain ID and a 20-byte address.
  if (chainType !== 0 || referenceLength === 0 || addressLength !== 20) {
    return null;
  }
  const chainId = Number(
    BigInt(`0x${hex.slice(10, 10 + referenceLength * 2)}`),
  );
  if (!Number.isSafeInteger(chainId) || chainId === 0) return null;
  const address = checksumEthAddress(
    `0x${hex.slice((6 + referenceLength) * 2)}`,
  );
  // ERC-7828 leaves the version out of the checksum.
  const checksum = keccak256(`0x${hex.slice(4)}`)
    .slice(2, 10)
    .toUpperCase();
  return { text: `${address}@eip155:${chainId}#${checksum}`, address, chainId };
}

/** An interoperableAddressName field: the ERC-7828 name, with addressName's checks on its chain. */
export function describeInteroperable(
  field: Eip7730Field,
  raw: string,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): (AddressNameDisplay & { name: string }) | null {
  const parsed = interoperableName(raw);
  if (!parsed) return null;
  // The address's own chain decides its token; the request's chain stays the entry's.
  const onItsChain =
    field.params?.chainId === undefined &&
    field.params?.chainIdPath === undefined
      ? { ...field, params: { ...field.params, chainId: parsed.chainId } }
      : field;
  const shown = describeAddress(onItsChain, parsed.address, format, ctx);
  return shown && { ...shown, name: parsed.text, ens: false };
}

/** A tokenTicker field: its ticker beside the address, or the address with a warning. */
export function describeTokenTicker(
  field: Eip7730Field,
  raw: string,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): AddressNameDisplay | null {
  const address = asAddress(raw);
  if (!address) return null;
  const token = knownToken(format, ctx, field.params, address.toLowerCase());
  const warnings = token ? [] : [UNKNOWN_TOKEN_WARNING];
  return { address, sender: false, token, warnings, ens: true };
}

function nativeToken(chainId: number | undefined): TokenInfo | null {
  if (chainId === undefined) return null;
  return {
    decimals: NATIVE_DECIMALS,
    symbol: getNativeCurrencySymbol(chainId),
  };
}

function tokenAddress(params: Params, ctx: Eip7730FieldContext): string | null {
  if (typeof params?.tokenPath === 'string') {
    // A path may reach an address kept in a uint256, as 1inch orders do.
    const value = ctx.resolvePath(params.tokenPath);
    return value === null ? null : asAddress(value)?.toLowerCase() ?? null;
  }
  const token = typeof params?.token === 'string' ? params.token : null;
  return token && ADDRESS_RE.test(token) ? token.toLowerCase() : null;
}

function descriptorToken(
  format: Eip7730DisplayFormat,
  address: string,
  ctx: Eip7730FieldContext,
): TokenInfo | null {
  const tokens = format.metadata?.tokens;
  // The spec's token metadata names only the described contract, so another address cannot borrow a ticker.
  if (!tokens || ctx.contractAddress?.toLowerCase() !== address) return null;
  const info = Object.prototype.hasOwnProperty.call(tokens, '*')
    ? tokens['*']
    : undefined;
  if (!isDecimals(info?.decimals) || typeof info.ticker !== 'string') {
    return null;
  }
  return { decimals: info.decimals, symbol: info.ticker };
}

function chainOf(value: unknown): number | undefined {
  const n =
    typeof value === 'string' || typeof value === 'number'
      ? Number(value)
      : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/** The chain a token lives on: the field's `chainId`/`chainIdPath`, else the request's. */
function tokenChain(
  params: Params,
  ctx: Eip7730FieldContext,
): number | undefined {
  if (typeof params?.chainIdPath === 'string') {
    return chainOf(ctx.resolvePath(params.chainIdPath));
  }
  return params?.chainId !== undefined ? chainOf(params.chainId) : ctx.chainId;
}

function knownToken(
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
  params: Params,
  address: string,
): TokenMetadata | null {
  const chainId = tokenChain(params, ctx);
  // An entry's own token metadata describes its own chain only.
  const own =
    chainId === ctx.chainId ? descriptorToken(format, address, ctx) : null;
  return own
    ? { symbol: own.symbol, decimals: own.decimals }
    : lookupToken(chainId, address);
}

function resolveToken(
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
  params: Params,
  address: string | null,
): TokenInfo | null {
  if (!address) return null;
  if (literalAddresses(params?.nativeCurrencyAddress).includes(address)) {
    return nativeToken(tokenChain(params, ctx));
  }
  const known = knownToken(format, ctx, params, address);
  return known ? { decimals: known.decimals, symbol: known.symbol } : null;
}

function reachesThreshold(amount: bigint, threshold: unknown): boolean {
  if (typeof threshold !== 'string' && typeof threshold !== 'number') {
    return false;
  }
  const limit = toBigInt(String(threshold));
  return limit !== null && amount >= limit;
}

function trimAmount(raw: string): string {
  if (!raw.includes('.')) return raw;
  return raw.replace(/0+$/, '').replace(/\.$/, '');
}

function amountText(amount: bigint, token: TokenInfo): string {
  return `${trimAmount(formatUnits(amount, token.decimals))} ${token.symbol}`;
}

function message(params: Params, fallback: string): string {
  return typeof params?.message === 'string' ? params.message : fallback;
}

function formatTokenAmount(
  value: string,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
  params: Params,
): Eip7730FieldDisplay {
  const amount = toBigInt(value);
  if (amount === null) return { text: value };
  const address = tokenAddress(params, ctx);
  const token = resolveToken(format, ctx, params, address);
  // Without a ticker the address is the only way to tell which token this is.
  const unknown = !token && address ? { unknownTokenAddress: address } : {};
  if (!reachesThreshold(amount, params?.threshold)) {
    return token
      ? { text: amountText(amount, token) }
      : { text: value, warnings: [UNKNOWN_TOKEN_WARNING], ...unknown };
  }
  const text = message(params, 'Unlimited');
  const warnings = UNLIMITED_MESSAGES.has(text)
    ? [UNLIMITED_APPROVAL_WARNING]
    : [];
  if (!token) warnings.push(UNKNOWN_TOKEN_WARNING);
  return {
    text: token ? `${text} ${token.symbol}` : text,
    ...(warnings.length > 0 && { warnings }),
    ...unknown,
  };
}

function formatAmount(
  value: string,
  ctx: Eip7730FieldContext,
  params: Params,
): Eip7730FieldDisplay {
  const amount = toBigInt(value);
  if (amount === null) return { text: value };
  if (reachesThreshold(amount, params?.threshold)) {
    return { text: message(params, 'All') };
  }
  const native = nativeToken(ctx.chainId);
  return { text: native ? amountText(amount, native) : value };
}

// A maximum value means "never expires"; it is past any date RFC 3339 can write.
function formatDate(value: string): string {
  const seconds = Number(value);
  return (
    (value.trim() !== '' && seconds >= 0 && rfc3339(seconds * 1000)) || value
  );
}

const SI_PREFIXES: Record<number, string> = {
  [-30]: 'q',
  [-27]: 'r',
  [-24]: 'y',
  [-21]: 'z',
  [-18]: 'a',
  [-15]: 'f',
  [-12]: 'p',
  [-9]: 'n',
  [-6]: 'µ',
  [-3]: 'm',
  0: '',
  3: 'k',
  6: 'M',
  9: 'G',
  12: 'T',
  15: 'P',
  18: 'E',
  21: 'Z',
  24: 'Y',
  27: 'R',
  30: 'Q',
};

// The value over 10^shift; formatUnits takes no negative shift.
function shifted(n: bigint, shift: number): string {
  return shift >= 0
    ? trimAmount(formatUnits(n, shift))
    : (n * 10n ** BigInt(-shift)).toString();
}

function formatUnit(value: string, params: Params): string {
  const n = toBigInt(value);
  if (n === null) return value;
  const base = typeof params?.base === 'string' ? params.base : '';
  const decimals = isDecimals(params?.decimals) ? params.decimals : 0;
  if (params?.prefix !== true || n === 0n) {
    return `${shifted(n, decimals)}${base}`;
  }
  const digits = (n < 0n ? -n : n).toString().length;
  const exponent = Math.floor((digits - 1 - decimals) / 3) * 3;
  const power = Math.min(30, Math.max(-30, exponent));
  return `${shifted(n, decimals + power)}${SI_PREFIXES[power]}${base}`;
}

function formatDuration(value: string): string {
  const n = toBigInt(value);
  if (n === null || n < 0n) return value;
  const two = (part: bigint) => part.toString().padStart(2, '0');
  return `${two(n / 3600n)}:${two((n % 3600n) / 60n)}:${two(n % 60n)}`;
}

function formatEnum(
  value: string,
  format: Eip7730DisplayFormat,
  params: Params,
): string {
  const ref = typeof params?.$ref === 'string' ? params.$ref : undefined;
  if (!ref) return value;
  const id = ref.startsWith(ENUM_REF_PREFIX)
    ? ref.slice(ENUM_REF_PREFIX.length)
    : ref;
  const labels = format.metadata?.enums?.[id];
  if (!labels) return value;
  // Keys are decimal; a slice of bytes arrives as hex.
  const n = toBigInt(value);
  const key = Object.prototype.hasOwnProperty.call(labels, value)
    ? value
    : n !== null
    ? n.toString()
    : null;
  const label =
    key !== null && Object.prototype.hasOwnProperty.call(labels, key)
      ? labels[key]
      : null;
  return typeof label === 'string' ? label : value;
}

export function formatEip7730Field(
  field: Eip7730Field,
  value: string | null,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): Eip7730FieldDisplay {
  if (value === null) return { text: '—' };
  const encrypted = encryptedLabel(field);
  if (encrypted !== null) return { text: encrypted, encryptedValue: value };
  try {
    switch (field.format) {
      case 'tokenAmount':
        return formatTokenAmount(value, format, ctx, field.params);
      case 'amount':
        return formatAmount(value, ctx, field.params);
      case 'date':
        // A block height read as a timestamp would show a 1970 date.
        return {
          text:
            field.params?.encoding === 'blockheight'
              ? value
              : formatDate(value),
        };
      case 'duration':
        return { text: formatDuration(value) };
      case 'chainId': {
        const chainId = chainOf(value);
        return { text: chainId ? getChainName(chainId) : value };
      }
      case 'unit':
        return { text: formatUnit(value, field.params) };
      case 'enum':
        return { text: formatEnum(value, format, field.params) };
      default:
        return { text: value };
    }
  } catch {
    // A descriptor from a later registry must never take the review screen down.
    return { text: value };
  }
}

export type FieldValue =
  | ({ kind: 'address'; name?: string } & AddressNameDisplay)
  | ({ kind: 'text' } & Eip7730FieldDisplay);

export function describeFieldValue(
  field: Eip7730Field,
  raw: string | null,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): FieldValue {
  // An encrypted value is a ciphertext handle, never an address.
  const named =
    raw === null || field.encryption
      ? null
      : field.format === 'addressName'
      ? describeAddress(field, raw, format, ctx)
      : field.format === 'tokenTicker'
      ? describeTokenTicker(field, raw, format, ctx)
      : field.format === 'interoperableAddressName'
      ? describeInteroperable(field, raw, format, ctx)
      : null;
  return named
    ? { kind: 'address', ...named }
    : { kind: 'text', ...formatEip7730Field(field, raw, format, ctx) };
}

// The spec's injection rule: a value that could fake, hide or crowd out text sends the review back to `intent`.
const UNSAFE_TEXT_RE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;
const MAX_INTERPOLATED_VALUE = 80;
const MAX_INTERPOLATED_SENTENCE = 200;

const isSafeInterpolation = (text: string) =>
  text.length <= MAX_INTERPOLATED_VALUE && !UNSAFE_TEXT_RE.test(text);

/** The sentence with every placeholder formatted as its field is; null means show `intent`. */
export function interpolateIntent(
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): string | null {
  const parts = format.interpolatedIntent
    ? interpolationParts(format.interpolatedIntent)
    : null;
  if (!parts) return null;
  let sentence = '';
  for (const part of parts) {
    if ('text' in part) {
      sentence += part.text;
      continue;
    }
    const path = normalizeFieldPath(part.path);
    const field = format.fields.find(f => normalizeFieldPath(f.path) === path);
    if (!field || field.format === 'calldata') return null;
    const texts = fieldTexts(field, format, ctx);
    if (!texts || !texts.every(isSafeInterpolation)) return null;
    sentence += texts.join(', ');
  }
  return sentence.length <= MAX_INTERPOLATED_SENTENCE ? sentence : null;
}

// Formatted as the rows show it, one text per array element.
function fieldTexts(
  field: Eip7730Field,
  format: Eip7730DisplayFormat,
  ctx: Eip7730FieldContext,
): string[] | null {
  const selector =
    field.value === undefined ? firstArraySelector(field.path) : null;
  const indices = selector ? arrayIndices(selector, ctx) : null;
  if (selector && indices) {
    if (indices.length === 0) return null;
    const texts: string[] = [];
    for (let n = 0; n < indices.length; n += 1) {
      const element = fieldTexts(
        bindField(field, selector, n, ctx),
        format,
        ctx,
      );
      if (!element) return null;
      texts.push(...element);
    }
    return texts;
  }
  const raw = field.value ?? ctx.resolvePath(field.path);
  if (raw === null) return null;
  const shown = describeFieldValue(field, raw, format, ctx);
  if (shown.kind === 'text') return [shown.text];
  return [
    shown.sender
      ? shown.address ?? SENDER_TEXT
      : shown.name ?? shown.token?.symbol ?? shown.address ?? SENDER_TEXT,
  ];
}
