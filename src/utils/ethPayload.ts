import { RLP } from '@ethereumjs/rlp';
import { keccak_256 } from '@noble/hashes/sha3.js';

import { getChainName } from './chainMetadata';

import {
  nonStandardDomainFields,
  oddLengthBytesPath,
  parseEip712Prehashed,
  parseEip712RawTypedData,
  uncoveredDomainFields,
  type Eip712Prehashed,
  type Eip712RawTypedData,
} from './eip712';
import {
  computeEip712DigestFromJson,
  computeEip712DigestFromPrehashed,
  computeErc191Digest,
} from './erc8213';
import { isWholeBytes } from './hex';

/** An unsigned transaction's fields, decoded from the bytes the card signs. */
export type TransactionFields = {
  gasLimit: bigint;
  /** Empty for a contract creation. */
  to: Uint8Array;
  value: bigint;
  data: Uint8Array;
  fees:
    | { kind: 'legacy'; gasPrice: bigint }
    | { kind: 'eip1559'; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };
};

/**
 * The one classification of an Ethereum sign request: the digest a variant carries is the
 * one the card signs and the review shows.
 */
export type EthPayload =
  | {
      kind: 'tx-legacy';
      raw: Uint8Array;
      chainId: number;
      tx: TransactionFields;
    }
  | {
      kind: 'tx-eip2930';
      raw: Uint8Array;
      chainId: number;
      tx: TransactionFields;
    }
  | {
      kind: 'tx-eip1559';
      raw: Uint8Array;
      chainId: number;
      tx: TransactionFields;
    }
  | { kind: 'personal-message'; raw: Uint8Array; digest: string }
  | { kind: 'eip712-json'; typedData: Eip712RawTypedData; digest: string }
  | { kind: 'eip712-prehashed'; prehashed: Eip712Prehashed; digest: string }
  | { kind: 'raw-digest'; digest: string }
  | {
      kind: 'invalid';
      reason: string;
      chainId?: number;
      /** Set when the bytes decode as a transaction refused for its chain. */
      tx?: TransactionFields;
    };

export type EthPayloadKind = EthPayload['kind'];

type TransactionKind = 'tx-legacy' | 'tx-eip2930' | 'tx-eip1559';

const RLP_LIST_MIN = 0xc0;
const DIGEST_BYTES = 32;
const ADDRESS_BYTES = 20;
const MAX_CHAIN_ID = BigInt(Number.MAX_SAFE_INTEGER);
// Keeps a legacy transaction's v, 35 + 2 * chainId + recId, an exact number.
const MAX_LEGACY_CHAIN_ID = (MAX_CHAIN_ID - 36n) / 2n;

const TRANSACTION_NAMES: Record<TransactionKind, string> = {
  'tx-legacy': 'A legacy transaction',
  'tx-eip2930': 'An EIP-2930 transaction',
  'tx-eip1559': 'An EIP-1559 transaction',
};

function invalid(reason: string): EthPayload {
  return { kind: 'invalid', reason };
}

function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, '');
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function toBigInt(bytes: Uint8Array): bigint {
  return bytes.length === 0
    ? 0n
    : BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
}

function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

type DecodedTransaction = { chainId: bigint; tx: TransactionFields };

/** The transaction the bytes hold, or why they hold none. */
function decodeTransaction(
  kind: TransactionKind,
  raw: Uint8Array,
): DecodedTransaction | string {
  let list: unknown;
  try {
    list = RLP.decode(kind === 'tx-legacy' ? raw : raw.subarray(1));
  } catch {
    return 'The transaction is not valid RLP.';
  }
  if (!Array.isArray(list)) {
    return 'The transaction is not an RLP list.';
  }
  if (kind === 'tx-legacy' && list.length === 6) {
    return 'The legacy transaction has no EIP-155 chain ID, so it would be valid on every chain.';
  }
  const length = kind === 'tx-eip2930' ? 8 : 9;
  if (list.length !== length) {
    return `${TRANSACTION_NAMES[kind]} has ${length} fields, this one has ${list.length}.`;
  }
  const values = kind === 'tx-legacy' ? list : list.slice(0, -1);
  if (!values.every(isBytes)) {
    return 'A transaction field holds a list where a value belongs.';
  }
  if (kind !== 'tx-legacy' && !Array.isArray(list[length - 1])) {
    return 'The access list of the transaction is not a list.';
  }

  let chain: Uint8Array;
  let tx: TransactionFields;
  if (kind === 'tx-legacy') {
    const [, gasPrice, gasLimit, to, value, data, chainId, r, s] = values;
    if (r.length > 0 || s.length > 0) {
      return 'An EIP-155 legacy transaction ends with an empty r and s, and this one does not.';
    }
    chain = chainId;
    tx = {
      gasLimit: toBigInt(gasLimit),
      to,
      value: toBigInt(value),
      data,
      fees: { kind: 'legacy', gasPrice: toBigInt(gasPrice) },
    };
  } else if (kind === 'tx-eip2930') {
    const [chainId, , gasPrice, gasLimit, to, value, data] = values;
    chain = chainId;
    tx = {
      gasLimit: toBigInt(gasLimit),
      to,
      value: toBigInt(value),
      data,
      fees: { kind: 'legacy', gasPrice: toBigInt(gasPrice) },
    };
  } else {
    const [chainId, , priorityFee, maxFee, gasLimit, to, value, data] = values;
    chain = chainId;
    tx = {
      gasLimit: toBigInt(gasLimit),
      to,
      value: toBigInt(value),
      data,
      fees: {
        kind: 'eip1559',
        maxFeePerGas: toBigInt(maxFee),
        maxPriorityFeePerGas: toBigInt(priorityFee),
      },
    };
  }
  if (tx.to.length !== 0 && tx.to.length !== ADDRESS_BYTES) {
    return 'The recipient of the transaction is not 20 bytes.';
  }
  return { chainId: toBigInt(chain), tx };
}

function transaction(
  kind: TransactionKind,
  raw: Uint8Array,
  requestChainId: number | undefined,
): EthPayload {
  const decoded = decodeTransaction(kind, raw);
  if (typeof decoded === 'string') return invalid(decoded);
  const { tx } = decoded;
  if (
    decoded.chainId >
    (kind === 'tx-legacy' ? MAX_LEGACY_CHAIN_ID : MAX_CHAIN_ID)
  ) {
    return {
      kind: 'invalid',
      reason: 'The transaction names a chain ID out of range.',
      tx,
    };
  }
  const chainId = Number(decoded.chainId);
  // A typed transaction's v does not name the chain, so the review would show one chain while the card signs for another.
  if (requestChainId !== undefined && chainId !== requestChainId) {
    return {
      kind: 'invalid',
      reason: `The transaction is for ${getChainName(
        chainId,
      )}, but the request says ${getChainName(requestChainId)}.`,
      chainId,
      tx,
    };
  }
  return { kind, raw, chainId, tx };
}

/** The decoded transaction, also when refused for its chain, so the review keeps its rows. */
export function payloadTransaction(
  payload: EthPayload,
): TransactionFields | undefined {
  return 'tx' in payload ? payload.tx : undefined;
}

/** The chain to review and sign for: the transaction's own when it names one. */
export function payloadChainId(
  payload: EthPayload,
  requestChainId: number | undefined,
): number | undefined {
  return 'chainId' in payload && payload.chainId !== undefined
    ? payload.chainId
    : requestChainId;
}

export function classifyEthPayload(
  signData: string,
  dataType: number | undefined,
  requestChainId?: number,
): EthPayload {
  if (!isWholeBytes(signData)) {
    return invalid('Payload is not valid hex data.');
  }
  const hex = stripHexPrefix(signData);
  const raw = hexToBytes(hex);

  if (dataType === 1 || dataType === 4) {
    if (raw.length === 0) {
      return invalid('Transaction payload is empty.');
    }
    if (raw[0] === 0x01) {
      return transaction('tx-eip2930', raw, requestChainId);
    }
    if (dataType === 4 && raw[0] === 0x02) {
      return transaction('tx-eip1559', raw, requestChainId);
    }
    if (dataType === 1 && raw[0] >= RLP_LIST_MIN) {
      return transaction('tx-legacy', raw, requestChainId);
    }
    return invalid(
      `Unrecognized transaction payload (first byte 0x${raw[0]
        .toString(16)
        .padStart(2, '0')}).`,
    );
  }

  if (dataType === 3) {
    return { kind: 'personal-message', raw, digest: computeErc191Digest(raw) };
  }

  if (dataType === 2) {
    const typedData = parseEip712RawTypedData(signData);
    if (typedData) {
      if (!typedData.primaryType) {
        return invalid('EIP-712 typed data names no primaryType.');
      }
      const nonStandard = nonStandardDomainFields(typedData).join(', ');
      if (nonStandard) {
        return invalid(
          `The EIP-712 domain declares ${nonStandard}, so the signature would not be valid on the contract it names.`,
        );
      }
      const uncovered = uncoveredDomainFields(typedData).join(', ');
      if (uncovered) {
        return invalid(
          `The EIP-712 domain has fields the signature would not cover: ${uncovered}.`,
        );
      }
      const oddBytes = oddLengthBytesPath(typedData);
      if (oddBytes) {
        return invalid(
          `EIP-712 value ${oddBytes} has an odd number of hex digits, so it is not whole bytes.`,
        );
      }
      const digest = computeEip712DigestFromJson(
        typedData.domain,
        typedData.message,
        typedData.primaryType,
        typedData.types,
      );
      if (!digest) {
        return invalid('EIP-712 typed data could not be hashed.');
      }
      return { kind: 'eip712-json', typedData, digest };
    }
    const prehashed = parseEip712Prehashed(signData);
    if (prehashed) {
      return {
        kind: 'eip712-prehashed',
        prehashed,
        digest: computeEip712DigestFromPrehashed(
          prehashed.domainSeparatorHash,
          prehashed.messageHash,
        ),
      };
    }
    if (raw.length === DIGEST_BYTES) {
      return { kind: 'raw-digest', digest: `0x${hex.toLowerCase()}` };
    }
    return invalid(
      'EIP-712 payload is neither typed-data JSON, a pre-hashed \\x19\\x01 payload, nor a 32-byte digest.',
    );
  }

  // dataType 0 or none: a QR request that carries the 32-byte digest itself.
  if (raw.length === DIGEST_BYTES) {
    return { kind: 'raw-digest', digest: `0x${hex.toLowerCase()}` };
  }
  return invalid(
    `Expected a 32-byte digest, got ${raw.length} byte${
      raw.length === 1 ? '' : 's'
    }.`,
  );
}

/** The 32-byte digest the card signs; throws on 'invalid', which never gets a Sign button. */
export function signingDigest(payload: EthPayload): Uint8Array {
  switch (payload.kind) {
    case 'tx-legacy':
    case 'tx-eip2930':
    case 'tx-eip1559':
      return keccak_256(payload.raw);
    case 'personal-message':
    case 'eip712-json':
    case 'eip712-prehashed':
    case 'raw-digest':
      return hexToBytes(stripHexPrefix(payload.digest));
    case 'invalid':
      throw new Error(`Cannot sign: ${payload.reason}`);
  }
}
