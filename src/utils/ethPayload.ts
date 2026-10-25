import { RLP } from '@ethereumjs/rlp';
import { keccak_256 } from '@noble/hashes/sha3.js';

import { getChainName } from './chainMetadata';

import {
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

/**
 * The one classification of an Ethereum sign request: the digest a variant carries is the
 * one the card signs and the review shows. Transactions follow txParser.parseTx's accept set.
 */
export type EthPayload =
  | { kind: 'tx-legacy'; raw: Uint8Array; chainId?: number }
  | { kind: 'tx-eip2930'; raw: Uint8Array; chainId?: number }
  | { kind: 'tx-eip1559'; raw: Uint8Array; chainId?: number }
  | { kind: 'personal-message'; raw: Uint8Array; digest: string }
  | { kind: 'eip712-json'; typedData: Eip712RawTypedData; digest: string }
  | { kind: 'eip712-prehashed'; prehashed: Eip712Prehashed; digest: string }
  | { kind: 'raw-digest'; digest: string }
  | { kind: 'invalid'; reason: string; chainId?: number };

export type EthPayloadKind = EthPayload['kind'];

const RLP_LIST_MIN = 0xc0;
const DIGEST_BYTES = 32;

function invalid(reason: string): EthPayload {
  return { kind: 'invalid', reason };
}

function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, '');
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/** The chain the bytes sign for: first in a typed transaction, seventh in an EIP-155 legacy one. */
function signedChainId(raw: Uint8Array, typed: boolean): bigint | undefined {
  try {
    const decoded = RLP.decode(typed ? raw.subarray(1) : raw);
    if (!Array.isArray(decoded)) return undefined;
    const field = typed
      ? decoded[0]
      : decoded.length === 9
      ? decoded[6]
      : undefined;
    if (!(field instanceof Uint8Array)) return undefined;
    return field.length === 0
      ? 0n
      : BigInt(`0x${Buffer.from(field).toString('hex')}`);
  } catch {
    // parseTx rejects what does not decode, at scan time.
    return undefined;
  }
}

function transaction(
  kind: 'tx-legacy' | 'tx-eip2930' | 'tx-eip1559',
  raw: Uint8Array,
  requestChainId: number | undefined,
): EthPayload {
  const signed = signedChainId(raw, kind !== 'tx-legacy');
  if (signed === undefined) return { kind, raw };
  if (signed > BigInt(Number.MAX_SAFE_INTEGER)) {
    return invalid('The transaction names a chain ID out of range.');
  }
  const chainId = Number(signed);
  // A typed transaction's v does not name the chain, so the review would show one chain while the card signs for another.
  if (requestChainId !== undefined && chainId !== requestChainId) {
    return {
      kind: 'invalid',
      reason: `The transaction is for ${getChainName(
        chainId,
      )}, but the request says ${getChainName(requestChainId)}.`,
      chainId,
    };
  }
  return { kind, raw, chainId };
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
