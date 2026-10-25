import {
  decodeAbiParameters,
  parseAbiItem,
  toFunctionSelector,
  type AbiFunction,
} from 'viem';

import {
  eip712FieldType,
  isMiscasedAddress,
  type Eip712RawTypedData,
} from '@/utils/eip712';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import { isWholeBytes } from '@/utils/hex';

export type Eip7730Container = {
  from?: string;
  to?: string;
  value?: string;
  chainId?: number;
};

type Root = '#' | '@' | '$';

function splitRoot(path: string): { root: Root; rest: string } {
  if (path.startsWith('@.')) return { root: '@', rest: path.slice(2) };
  if (path.startsWith('$.')) return { root: '$', rest: path.slice(2) };
  if (path.startsWith('#.')) return { root: '#', rest: path.slice(2) };
  return { root: '#', rest: path };
}

function containerValue(
  key: string,
  container: Eip7730Container,
): string | null {
  switch (key) {
    case 'from':
      return container.from ? checksumEthAddress(container.from) : null;
    case 'to':
      return container.to ? checksumEthAddress(container.to) : null;
    case 'value':
      return container.value ?? null;
    case 'chainId':
      return container.chainId === undefined ? null : String(container.chainId);
    default:
      return null;
  }
}

function indexOfClosingBracket(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    const c = s[i];
    if (c === '[') depth += 1;
    else if (c === ']') {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

const SLICE_RE = /^(-?\d+)?:(-?\d+)?$/;
const WORD = 2n ** 256n;

export function sliceRange(
  length: number,
  start: string | undefined,
  end: string | undefined,
): [number, number] {
  const at = (text: string | undefined, fallback: number) => {
    if (text === undefined || text === '') return fallback;
    const n = Number(text);
    return Math.min(length, Math.max(0, n < 0 ? length + n : n));
  };
  return [at(start, 0), at(end, length)];
}

function wordHex(n: bigint): string | null {
  const v = n < 0n ? WORD + n : n;
  return v >= 0n && v < WORD ? v.toString(16).padStart(64, '0') : null;
}

const NUMBER_OR_HEX_RE = /^(0x[0-9a-f]*|-?\d+)$/i;

function utf8Bytes(text: string): number[] | null {
  let encoded: string;
  try {
    encoded = encodeURIComponent(text);
  } catch {
    return null;
  }
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

const hexOf = (bytes: number[]) =>
  bytes.map(b => b.toString(16).padStart(2, '0')).join('');

// A slice that cuts a character in two has no text, so it shows its bytes.
function utf8Text(bytes: number[]): string {
  try {
    return decodeURIComponent(bytes.map(b => `%${hexOf([b])}`).join(''));
  } catch {
    return `0x${hexOf(bytes)}`;
  }
}

// The spec slices a number as its 32-byte ABI word.
function bytesHex(value: unknown): string | null {
  if (typeof value === 'bigint') return wordHex(value);
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? wordHex(BigInt(value)) : null;
  }
  if (typeof value !== 'string') return null;
  if (/^0x([0-9a-f]{2})*$/i.test(value)) return value.slice(2).toLowerCase();
  if (/^(0x[0-9a-f]+|-?\d+)$/i.test(value)) return wordHex(BigInt(value));
  return null;
}

function select(value: unknown, selector: string): unknown[] {
  if (selector === '' || selector === '*') {
    return Array.isArray(value) ? value : [];
  }
  if (/^-?\d+$/.test(selector)) {
    if (!Array.isArray(value)) return [];
    const n = Number(selector);
    const index = n < 0 ? value.length + n : n;
    return index >= 0 && index < value.length ? [value[index]] : [];
  }
  const slice = SLICE_RE.exec(selector);
  if (!slice) return [];
  if (Array.isArray(value)) {
    const [start, end] = sliceRange(value.length, slice[1], slice[2]);
    return value.slice(start, end);
  }
  if (typeof value === 'string' && !NUMBER_OR_HEX_RE.test(value)) {
    const bytes = utf8Bytes(value);
    if (!bytes) return [];
    const [start, end] = sliceRange(bytes.length, slice[1], slice[2]);
    return start < end ? [utf8Text(bytes.slice(start, end))] : [];
  }
  const hex = bytesHex(value);
  if (hex === null) return [];
  const [start, end] = sliceRange(hex.length / 2, slice[1], slice[2]);
  return start < end ? [`0x${hex.slice(start * 2, end * 2)}`] : [];
}

function valuesAt(path: string, root: unknown): unknown[] {
  let current: unknown[] = [root];
  let i = 0;
  while (i < path.length && current.length > 0) {
    if (path[i] === '.') {
      i += 1;
      continue;
    }
    if (path[i] === '[') {
      const end = indexOfClosingBracket(path, i + 1);
      if (end === -1) return [];
      const selector = path.slice(i + 1, end);
      current = current.flatMap(value => select(value, selector));
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== '.' && path[j] !== '[') j += 1;
    const key = path.slice(i, j);
    current = current.flatMap(value =>
      value &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, key)
        ? [(value as Record<string, unknown>)[key]]
        : [],
    );
    i = j;
  }
  return current.filter(value => value !== null && value !== undefined);
}

function toText(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, (_key, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
  }
  // String(1e21) is "1e+21"; an integer goes out as the digits it is signed as.
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value).toString();
  }
  return String(value);
}

function valueAt(path: string, root: unknown): string | null {
  const [first] = valuesAt(path, root);
  return first === undefined ? null : toText(first);
}

function resolveEach(
  path: string,
  root: unknown,
  container: Eip7730Container,
): string[] {
  if (!path) return [];
  const split = splitRoot(path);
  if (split.root === '@') {
    const value = containerValue(split.rest, container);
    return value === null ? [] : [value];
  }
  if (split.root === '$') return [];
  return valuesAt(split.rest, root).map(toText);
}

export function resolveEip712FieldValue(
  path: string,
  message: unknown,
  container: Eip7730Container = {},
): string | null {
  if (!path) return null;
  const { root, rest } = splitRoot(path);
  if (root === '@') return containerValue(rest, container);
  if (root === '$') return null;
  return valueAt(rest, message);
}

/** Arguments named as the descriptor's own signature names them, or null when it does not fit. */
export function decodeArgsBySignature(
  signature: string,
  data: string,
): Record<string, unknown> | null {
  if (!isWholeBytes(data)) return null;
  try {
    const item = parseAbiItem(`function ${signature}`) as AbiFunction;
    if (toFunctionSelector(item) !== data.slice(0, 10).toLowerCase()) {
      return null;
    }
    // viem refuses stray bytes after a call with no arguments, though it ignores them otherwise.
    if (item.inputs.length === 0) return {};
    const values = decodeAbiParameters(
      item.inputs,
      `0x${data.slice(10)}` as `0x${string}`,
    );
    return Object.fromEntries(
      item.inputs.map((input, i) => [input.name || String(i), values[i]]),
    );
  } catch {
    return null;
  }
}

export function resolveEip712FieldValues(
  path: string,
  message: unknown,
  container: Eip7730Container = {},
): string[] {
  return resolveEach(path, message, container);
}

export function buildArgsEachResolver(
  args: Record<string, unknown>,
  container: Eip7730Container = {},
): (path: string) => string[] {
  return (path: string) => resolveEach(path, args, container);
}

export function buildArgsPathResolver(
  args: Record<string, unknown>,
  container: Eip7730Container = {},
): (path: string) => string | null {
  return (path: string) => {
    if (!path) return null;
    const { root, rest } = splitRoot(path);
    if (root === '@') return containerValue(rest, container);
    // `$.` points into the descriptor itself, which is not available here.
    if (root === '$') return null;
    return valueAt(rest, args);
  };
}

/** EIP-712 resolvers that write an `address` field in ERC-55, as the spec's raw format asks. */
export function buildEip712Resolvers(
  typed: Pick<Eip712RawTypedData, 'types' | 'primaryType' | 'message'>,
  container: Eip7730Container = {},
): {
  resolvePath: (path: string) => string | null;
  resolveEach: (path: string) => string[];
  miscasedAt: (path: string) => boolean;
} {
  const isAddress = (path: string) =>
    !path.startsWith('@.') &&
    eip712FieldType(typed.types, typed.primaryType, path) === 'address';
  const write = (path: string, value: string) =>
    isAddress(path) ? checksumEthAddress(value) : value;
  return {
    resolvePath: path => {
      const value = resolveEip712FieldValue(path, typed.message, container);
      return value === null ? null : write(path, value);
    },
    resolveEach: path =>
      resolveEip712FieldValues(path, typed.message, container).map(value =>
        write(path, value),
      ),
    miscasedAt: path =>
      isAddress(path) &&
      resolveEip712FieldValues(path, typed.message, container).some(
        isMiscasedAddress,
      ),
  };
}
