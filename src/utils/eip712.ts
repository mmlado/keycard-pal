import { validateTypedData } from 'viem';

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
    };

// \x19\x01 prefix + 32-byte domain separator + 32-byte message hash = 66 bytes
const PREHASHED_PREFIX = '1901';
const PREHASHED_BYTE_LENGTH = 66;
const UINT160_MAX = 2n ** 160n - 1n;
const UINT256_MAX = 2n ** 256n - 1n;

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
      acc[key] = stringifyValue(value[key]);
      return acc;
    }, {});
}

function toAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^0x[0-9a-fA-F]{40}$/.test(value)
    ? checksumEthAddress(value)
    : undefined;
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
  primaryType: string;
  types: Record<string, unknown>;
};

export function parseEip712RawTypedData(
  signDataHex: string,
): Eip712RawTypedData | null {
  const json = decodeUtf8(signDataHex);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isJsonObject(parsed)) return null;
    return {
      domain: isJsonObject(parsed.domain) ? parsed.domain : {},
      message: isJsonObject(parsed.message) ? parsed.message : {},
      primaryType:
        typeof parsed.primaryType === 'string'
          ? parsed.primaryType
          : 'EIP712Domain',
      types: isJsonObject(parsed.types) ? parsed.types : {},
    };
  } catch {
    return null;
  }
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

    validateTypedData({
      domain: isJsonObject(parsed.domain) ? parsed.domain : {},
      message: isJsonObject(parsed.message) ? parsed.message : {},
      primaryType:
        typeof parsed.primaryType === 'string'
          ? parsed.primaryType
          : 'EIP712Domain',
      types: isJsonObject(parsed.types) ? parsed.types : {},
    });

    return {
      rawJson: JSON.stringify(parsed, null, 2),
      primaryType:
        typeof parsed.primaryType === 'string' ? parsed.primaryType : undefined,
      domain: toDisplayMap(parsed.domain),
      message: toDisplayMap(parsed.message),
      special: parseSpecialReview(parsed),
    };
  } catch {
    return null;
  }
}
