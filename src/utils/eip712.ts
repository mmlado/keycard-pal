import {
  getTypesForEIP712Domain,
  validateTypedData,
  type TypedDataDomain,
} from 'viem';

import { checksumEthAddress } from './ethereumAddress';
import { ensureHexPrefix } from './hex';
import { decodeCalldata, type DecodedCall } from './txParser';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

export type Eip712Summary = {
  rawJson: string;
  primaryType?: string;
  domain: Record<string, string>;
  message: Record<string, string>;
  /** `domain.<key>` and `message.<key>` of the rows that hold an address with a wrong checksum. */
  miscasedAddresses: string[];
  special?: Eip712SpecialReview;
};

export type Eip712Prehashed = {
  domainSeparatorHash: string;
  messageHash: string;
};

export type Eip712SpecialReview =
  | {
      kind: 'permit';
      tokenContract?: string;
      chainId?: number;
      spender: string;
      amount: bigint;
      deadline?: string;
      unlimited: boolean;
      miscased: PermitAddressField[];
    }
  | {
      kind: 'permit-single';
      tokenContract: string;
      chainId?: number;
      spender: string;
      amount: bigint;
      deadline?: string;
      expiration?: string;
      unlimited: boolean;
      miscased: PermitAddressField[];
    }
  | {
      kind: 'safe-tx';
      safeAddress?: string;
      chainId?: number;
      to: string;
      value: string;
      data?: string;
      decodedCall?: DecodedCall;
      operation: string;
      safeTxGas: string;
      baseGas: string;
      gasPrice: string;
      gasToken: string;
      refundReceiver: string;
      nonce: string;
      miscased: SafeTxAddressField[];
    };

type PermitAddressField = 'tokenContract' | 'spender';
type SafeTxAddressField = 'safeAddress' | 'to' | 'gasToken' | 'refundReceiver';

// \x19\x01 prefix + 32-byte domain separator + 32-byte message hash = 66 bytes
const PREHASHED_PREFIX = '1901';
const PREHASHED_BYTE_LENGTH = 66;
const UINT160_MAX = 2n ** 160n - 1n;
const UINT256_MAX = 2n ** 256n - 1n;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function parseEip712Prehashed(
  signDataHex: string,
): Eip712Prehashed | null {
  const hex = signDataHex.replace(/^0x/, '');
  if (hex.length !== PREHASHED_BYTE_LENGTH * 2) return null;
  if (!hex.startsWith(PREHASHED_PREFIX)) return null;
  return {
    domainSeparatorHash: '0x' + hex.slice(4, 68),
    messageHash: '0x' + hex.slice(68),
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeUtf8(hex: string): string | null {
  try {
    const stripped = ensureHexPrefix(hex).replace(/^0x/, '');
    return Buffer.from(stripped, 'hex').toString('utf8');
  } catch {
    return null;
  }
}

function stringifyValue(value: JsonValue): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function toDisplayMap(value: unknown): Record<string, string> {
  if (!isJsonObject(value)) {
    return {};
  }

  return Object.keys(value)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, string>>((acc, key) => {
      // Not an assignment: a key named __proto__ would set the prototype and lose its row.
      Object.defineProperty(acc, key, {
        value: stringifyValue(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
      return acc;
    }, {});
}

function toAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return ADDRESS_RE.test(value) ? checksumEthAddress(value) : undefined;
}

/** The fields whose address the request wrote with a wrong checksum. */
function miscasedFields<K extends string>(values: Record<K, unknown>): K[] {
  return (Object.keys(values) as K[]).filter(key => {
    const value = values[key];
    return typeof value === 'string' && isMiscasedAddress(value);
  });
}

function toHexBytes(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^0x[0-9a-fA-F]*$/.test(value) ? value : undefined;
}

function toBigIntValue(value: unknown): bigint | undefined {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return BigInt(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return BigInt(value);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function toDisplayValue(value: unknown): string | undefined {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return undefined;
}

function toChainId(value: unknown): number | undefined {
  const chainId = toBigIntValue(value);
  if (chainId === undefined) return undefined;
  const numeric = Number(chainId);
  return Number.isSafeInteger(numeric) ? numeric : undefined;
}

export function eip712DomainChainId(
  domain: Record<string, unknown>,
): number | undefined {
  const value = domain.chainId;
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
    ? toChainId(BigInt(value))
    : toChainId(value);
}

function parsePermit(parsed: JsonObject): Eip712SpecialReview | null {
  if (parsed.primaryType !== 'Permit') return null;
  const domain = isJsonObject(parsed.domain) ? parsed.domain : {};
  const message = isJsonObject(parsed.message) ? parsed.message : {};
  const spender = toAddress(message.spender);
  const amount = toBigIntValue(message.value);
  if (!spender || amount === undefined) return null;

  return {
    kind: 'permit',
    tokenContract: toAddress(domain.verifyingContract),
    chainId: toChainId(domain.chainId),
    spender,
    amount,
    deadline: toDisplayValue(message.deadline),
    unlimited: amount === UINT256_MAX,
    miscased: miscasedFields({
      tokenContract: domain.verifyingContract,
      spender: message.spender,
    }),
  };
}

function parsePermitSingle(parsed: JsonObject): Eip712SpecialReview | null {
  if (parsed.primaryType !== 'PermitSingle') return null;
  const domain = isJsonObject(parsed.domain) ? parsed.domain : {};
  const message = isJsonObject(parsed.message) ? parsed.message : {};
  const details = isJsonObject(message.details) ? message.details : {};
  const tokenContract = toAddress(details.token);
  const spender = toAddress(message.spender);
  const amount = toBigIntValue(details.amount);
  if (!tokenContract || !spender || amount === undefined) return null;

  return {
    kind: 'permit-single',
    tokenContract,
    chainId: toChainId(domain.chainId),
    spender,
    amount,
    deadline: toDisplayValue(message.sigDeadline),
    expiration: toDisplayValue(details.expiration),
    unlimited: amount === UINT160_MAX || amount === UINT256_MAX,
    miscased: miscasedFields({
      tokenContract: details.token,
      spender: message.spender,
    }),
  };
}

function parseSafeTx(parsed: JsonObject): Eip712SpecialReview | null {
  if (parsed.primaryType !== 'SafeTx') return null;
  const domain = isJsonObject(parsed.domain) ? parsed.domain : {};
  const message = isJsonObject(parsed.message) ? parsed.message : {};
  const to = toAddress(message.to);
  const data = toHexBytes(message.data);
  if (!to) return null;

  return {
    kind: 'safe-tx',
    safeAddress: toAddress(domain.verifyingContract),
    chainId: toChainId(domain.chainId),
    to,
    value: toDisplayValue(message.value) ?? '0',
    data,
    decodedCall: data ? decodeCalldata(data) ?? undefined : undefined,
    operation:
      toDisplayValue(message.operation) === '0'
        ? 'Call'
        : toDisplayValue(message.operation) === '1'
        ? 'Delegate call'
        : toDisplayValue(message.operation) ?? 'Unknown',
    safeTxGas: toDisplayValue(message.safeTxGas) ?? '0',
    baseGas: toDisplayValue(message.baseGas) ?? '0',
    gasPrice: toDisplayValue(message.gasPrice) ?? '0',
    gasToken: toAddress(message.gasToken) ?? String(message.gasToken ?? ''),
    refundReceiver:
      toAddress(message.refundReceiver) ?? String(message.refundReceiver ?? ''),
    nonce: toDisplayValue(message.nonce) ?? '0',
    miscased: miscasedFields({
      safeAddress: domain.verifyingContract,
      to: message.to,
      gasToken: message.gasToken,
      refundReceiver: message.refundReceiver,
    }),
  };
}

function parseSpecialReview(
  parsed: JsonObject,
): Eip712SpecialReview | undefined {
  return (
    parsePermit(parsed) ??
    parsePermitSingle(parsed) ??
    parseSafeTx(parsed) ??
    undefined
  );
}

export type Eip712RawTypedData = {
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
  /** Empty when the request names none, which the classification refuses. */
  primaryType: string;
  types: Record<string, unknown>;
};

function toRawTypedData(parsed: JsonObject): Eip712RawTypedData {
  return {
    domain: isJsonObject(parsed.domain) ? parsed.domain : {},
    message: isJsonObject(parsed.message) ? parsed.message : {},
    primaryType:
      typeof parsed.primaryType === 'string' ? parsed.primaryType : '',
    types: isJsonObject(parsed.types) ? parsed.types : {},
  };
}

export function parseEip712RawTypedData(
  signDataHex: string,
): Eip712RawTypedData | null {
  const json = decodeUtf8(signDataHex);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    // Hashing would read a field that is not an object as empty.
    return isJsonObject(parsed) &&
      isJsonObject(parsed.domain) &&
      isJsonObject(parsed.types) &&
      isJsonObject(parsed.message)
      ? toRawTypedData(parsed)
      : null;
  } catch {
    return null;
  }
}

type Eip712Member = { name: string; type: string };

function structMembers(
  types: Record<string, unknown>,
  name: string,
): Eip712Member[] | null {
  const members = types[name];
  if (!Array.isArray(members)) return null;
  return members.filter(
    (m): m is Eip712Member =>
      isJsonObject(m) &&
      typeof m.name === 'string' &&
      typeof m.type === 'string',
  );
}

// All lower or all upper case carries no checksum.
export function isMiscasedAddress(value: string): boolean {
  if (!ADDRESS_RE.test(value)) return false;
  const body = value.slice(2);
  return (
    /[a-f]/.test(body) &&
    /[A-F]/.test(body) &&
    checksumEthAddress(value) !== value
  );
}

function checksumTyped(
  types: Record<string, unknown>,
  type: string,
  value: unknown,
  onMiscased: () => void,
): unknown {
  const array = /^(.*)\[\d*\]$/.exec(type);
  if (array) {
    return Array.isArray(value)
      ? value.map(v => checksumTyped(types, array[1], v, onMiscased))
      : value;
  }
  if (type === 'address') {
    if (typeof value !== 'string' || !ADDRESS_RE.test(value)) return value;
    if (isMiscasedAddress(value)) onMiscased();
    return checksumEthAddress(value);
  }
  const members = structMembers(types, type);
  return members && isJsonObject(value)
    ? checksumStruct(types, members, value, onMiscased)
    : value;
}

function checksumStruct(
  types: Record<string, unknown>,
  members: Eip712Member[],
  value: Record<string, unknown>,
  onMiscased: (member: string) => void,
): Record<string, unknown> {
  const out = { ...value };
  for (const m of members) {
    if (!Object.prototype.hasOwnProperty.call(value, m.name)) continue;
    // Not an assignment: a member named __proto__ would set the prototype.
    Object.defineProperty(out, m.name, {
      value: checksumTyped(types, m.type, value[m.name], () =>
        onMiscased(m.name),
      ),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

// The domain type viem hashes: the declared one, else the one it derives from the domain.
function domainMembersOf(data: Eip712RawTypedData): Eip712Member[] {
  return (
    structMembers(data.types, 'EIP712Domain') ??
    getTypesForEIP712Domain({ domain: data.domain as TypedDataDomain })
  );
}

/** Domain fields outside the hashed domain type: the review would show them, unsigned. */
export function uncoveredDomainFields(data: Eip712RawTypedData): string[] {
  const covered = new Set(domainMembersOf(data).map(m => m.name));
  return Object.keys(data.domain).filter(key => !covered.has(key));
}

const STANDARD_DOMAIN_TYPES: Record<string, string> = {
  name: 'string',
  version: 'string',
  chainId: 'uint256',
  verifyingContract: 'address',
  salt: 'bytes32',
};

// Any other domain type changes the domain separator, so the contract the domain names would not accept it.
export function nonStandardDomainFields(data: Eip712RawTypedData): string[] {
  const declared = data.types.EIP712Domain;
  if (declared === undefined) return [];
  if (!Array.isArray(declared)) return ['an EIP712Domain that is not a list'];
  const seen = new Set<string>();
  return declared.flatMap(member => {
    // structMembers skips such a member, but viem still hashes it.
    if (
      !isJsonObject(member) ||
      typeof member.name !== 'string' ||
      typeof member.type !== 'string'
    ) {
      return ['a field without a name and a type'];
    }
    const { name, type } = member;
    const repeated = seen.has(name);
    seen.add(name);
    if (!Object.prototype.hasOwnProperty.call(STANDARD_DOMAIN_TYPES, name)) {
      return [`${name}, which EIP-712 does not define`];
    }
    if (repeated) return [`${name} twice`];
    const standard = STANDARD_DOMAIN_TYPES[name];
    return type === standard
      ? []
      : [`${name} as ${type} instead of ${standard}`];
  });
}

const STANDARD_DOMAIN_ORDER = Object.keys(STANDARD_DOMAIN_TYPES);

/** The domain type hash covers the order, so a contract hashing EIP-712's order computes another separator. */
export function domainFieldsInStandardOrder(data: Eip712RawTypedData): boolean {
  const declared = data.types.EIP712Domain;
  if (!Array.isArray(declared)) return true;
  const positions = declared
    .map(member =>
      isJsonObject(member) && typeof member.name === 'string'
        ? STANDARD_DOMAIN_ORDER.indexOf(member.name)
        : -1,
    )
    .filter(position => position >= 0);
  return positions.every(
    (position, i) => i === 0 || positions[i - 1] < position,
  );
}

/** Every declared `address` in EIP-55, which viem requires; the encoded 20 bytes stay the same. */
export function checksumEip712Addresses(data: Eip712RawTypedData): {
  typedData: Eip712RawTypedData;
  miscased: string[];
} {
  const miscased = new Set<string>();
  const domainMembers = domainMembersOf(data);
  const messageMembers = structMembers(data.types, data.primaryType) ?? [];
  return {
    typedData: {
      ...data,
      domain: isJsonObject(data.domain)
        ? checksumStruct(data.types, domainMembers, data.domain, k =>
            miscased.add(`domain.${k}`),
          )
        : data.domain,
      message: isJsonObject(data.message)
        ? checksumStruct(data.types, messageMembers, data.message, k =>
            miscased.add(`message.${k}`),
          )
        : data.message,
    },
    miscased: [...miscased],
  };
}

function oddBytesIn(
  types: Record<string, unknown>,
  type: string,
  value: unknown,
  path: string,
): string | null {
  const array = /^(.*)\[\d*\]$/.exec(type);
  if (array) {
    if (!Array.isArray(value)) return null;
    for (let i = 0; i < value.length; i += 1) {
      const found = oddBytesIn(types, array[1], value[i], `${path}.[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (/^bytes\d*$/.test(type)) {
    return typeof value === 'string' &&
      /^0x[0-9a-fA-F]*$/.test(value) &&
      value.length % 2 === 1
      ? path
      : null;
  }
  const members = structMembers(types, type);
  return members && isJsonObject(value)
    ? oddBytesInMembers(types, members, value, path)
    : null;
}

function oddBytesInMembers(
  types: Record<string, unknown>,
  members: Eip712Member[],
  value: Record<string, unknown>,
  path: string,
): string | null {
  for (const m of members) {
    if (!Object.prototype.hasOwnProperty.call(value, m.name)) continue;
    const found = oddBytesIn(types, m.type, value[m.name], `${path}.${m.name}`);
    if (found) return found;
  }
  return null;
}

/** The first `bytes` or `bytesN` value of odd hex length: viem pads it, so the card would sign other bytes. */
export function oddLengthBytesPath(data: Eip712RawTypedData): string | null {
  return (
    (isJsonObject(data.domain)
      ? oddBytesInMembers(
          data.types,
          domainMembersOf(data),
          data.domain,
          'domain',
        )
      : null) ??
    (isJsonObject(data.message)
      ? oddBytesInMembers(
          data.types,
          structMembers(data.types, data.primaryType) ?? [],
          data.message,
          'message',
        )
      : null)
  );
}

/** The declared type a field path reaches; null past a slice or a member the types do not list. */
export function eip712FieldType(
  types: Record<string, unknown>,
  primaryType: string,
  path: string,
): string | null {
  let type = primaryType;
  for (const part of path.replace(/^#\./, '').split('.')) {
    if (!part) continue;
    if (part.startsWith('[')) {
      if (part.includes(':') || !/\[\d*\]$/.test(type)) return null;
      type = type.replace(/\[\d*\]$/, '');
      continue;
    }
    const member = structMembers(types, type)?.find(m => m.name === part);
    if (!member) return null;
    type = member.type;
  }
  return type;
}

export function encodeEip712Type(
  primaryType: string,
  types: Record<string, unknown>,
): string | null {
  const referenced = new Set<string>();
  const visit = (name: string) => {
    if (referenced.has(name)) return;
    const members = structMembers(types, name);
    if (!members) return;
    referenced.add(name);
    members.forEach(m => visit(m.type.replace(/\[\d*\]/g, '')));
  };
  visit(primaryType);
  if (!referenced.has(primaryType)) return null;
  referenced.delete(primaryType);
  return [primaryType, ...[...referenced].sort()]
    .map(
      name =>
        `${name}(${structMembers(types, name)!
          .map(m => `${m.type} ${m.name}`)
          .join(',')})`,
    )
    .join('');
}

export function parseEip712Summary(signDataHex: string): Eip712Summary | null {
  const json = decodeUtf8(signDataHex);
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isJsonObject(parsed)) {
      return null;
    }

    const { typedData, miscased } = checksumEip712Addresses(
      toRawTypedData(parsed),
    );
    // A request that names no primary type is refused, but its fields still show.
    validateTypedData({
      ...typedData,
      primaryType: typedData.primaryType || 'EIP712Domain',
    } as Parameters<typeof validateTypedData>[0]);

    return {
      rawJson: JSON.stringify(parsed, null, 2),
      primaryType:
        typeof parsed.primaryType === 'string' ? parsed.primaryType : undefined,
      domain: toDisplayMap(typedData.domain),
      message: toDisplayMap(typedData.message),
      miscasedAddresses: miscased,
      special: parseSpecialReview(parsed),
    };
  } catch {
    return null;
  }
}
