import { keccak_256 } from '@noble/hashes/sha3.js';

import {
  parseEip712Prehashed,
  parseEip712RawTypedData,
  type Eip712Prehashed,
  type Eip712RawTypedData,
} from './eip712';
import {
  computeEip712DigestFromJson,
  computeEip712DigestFromPrehashed,
  computeErc191Digest,
} from './erc8213';

/**
 * The single classification of an Ethereum sign request payload.
 *
 * Every consumer of (signData, dataType) — the review Digests tab, the hash
 * sent to the card, and the signature v computation — must go through this
 * union so they can never disagree about what the bytes mean. The digest a
 * variant carries is the digest the card signs; the review displays the same
 * value ("the digest shown is the digest signed").
 *
 * Transaction classification mirrors txParser.parseTx's accept set exactly:
 * a payload parseTx rejects at scan time must classify as 'invalid' here.
 */
export type EthPayload =
  | { kind: 'tx-legacy'; raw: Uint8Array }
  | { kind: 'tx-eip2930'; raw: Uint8Array }
  | { kind: 'tx-eip1559'; raw: Uint8Array }
  | { kind: 'personal-message'; raw: Uint8Array; digest: string }
  | { kind: 'eip712-json'; typedData: Eip712RawTypedData; digest: string }
  | { kind: 'eip712-prehashed'; prehashed: Eip712Prehashed; digest: string }
  | { kind: 'raw-digest'; digest: string }
  | { kind: 'invalid'; reason: string };

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

export function classifyEthPayload(
  signData: string,
  dataType: number | undefined,
): EthPayload {
  const hex = stripHexPrefix(signData);
  if (!/^([0-9a-fA-F]{2})*$/.test(hex)) {
    return invalid('Payload is not valid hex data.');
  }
  const raw = hexToBytes(hex);

  if (dataType === 1 || dataType === 4) {
    if (raw.length === 0) {
      return invalid('Transaction payload is empty.');
    }
    if (raw[0] === 0x01) {
      return { kind: 'tx-eip2930', raw };
    }
    if (dataType === 4 && raw[0] === 0x02) {
      return { kind: 'tx-eip1559', raw };
    }
    if (dataType === 1 && raw[0] >= RLP_LIST_MIN) {
      return { kind: 'tx-legacy', raw };
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

  // dataType 0 / undefined: the payload must already be the 32-byte digest
  // (WalletConnect typed-data convention — see requestAdapter.handleTypedData).
  if (raw.length === DIGEST_BYTES) {
    return { kind: 'raw-digest', digest: `0x${hex.toLowerCase()}` };
  }
  return invalid(
    `Expected a 32-byte digest, got ${raw.length} byte${
      raw.length === 1 ? '' : 's'
    }.`,
  );
}

/**
 * The 32-byte digest the Keycard signs for this payload. The review Digests
 * tab renders the same value, so display and signature cannot diverge.
 * Throws on 'invalid' — buildSignKeycardParams never routes such a payload
 * to the Keycard screen.
 */
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
