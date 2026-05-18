/* eslint-disable no-bitwise */
import { ETHSignature } from '@keystonehq/bc-ur-registry-eth';
import Keycard from 'keycard-sdk';
import { hexToBytes } from 'viem';

import { ensureHexPrefix } from './hex';

// ── secp256k1 / Ethereum ─────────────────────────────────────────────────────
const SCALAR_BYTES = 32;
const V_BASE_LEGACY = 27; // EIP-712 / personal_sign: v = 27 + recId
const V_BASE_EIP155 = 35; // legacy EIP-155 tx:        v = 35 + 2*chainId + recId

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad32(arr: Uint8Array): Uint8Array {
  if (arr.length === SCALAR_BYTES) {
    return arr;
  }
  const padded = new Uint8Array(SCALAR_BYTES);
  padded.set(arr, SCALAR_BYTES - arr.length);
  return padded;
}

function encodeV(v: number): Uint8Array {
  if (v <= 0xff) {
    return new Uint8Array([v]);
  }
  if (v <= 0xffff) {
    return new Uint8Array([(v >> 8) & 0xff, v & 0xff]);
  }
  if (v <= 0xffffff) {
    return new Uint8Array([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  return new Uint8Array([
    (v >> 24) & 0xff,
    (v >> 16) & 0xff,
    (v >> 8) & 0xff,
    v & 0xff,
  ]);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Detects EIP-2718 tx type from first byte of signData (0x01=EIP-2930, 0x02=EIP-1559).
function detectTxType(signData?: string): number | undefined {
  if (!signData) return undefined;
  const hex = signData.startsWith('0x') ? signData.slice(2) : signData;
  const firstByte = parseInt(hex.slice(0, 2), 16);
  return firstByte === 0x01 || firstByte === 0x02 ? firstByte : undefined;
}

export function computeEthV(
  recId: number,
  dataType: number | undefined,
  chainId: number | undefined,
  txType?: number,
): number {
  if (txType === 0x01 || txType === 0x02) {
    return recId;
  }
  switch (dataType) {
    case 1:
      return V_BASE_EIP155 + 2 * (chainId ?? 0) + recId;
    case 4:
      return recId;
    default:
      return V_BASE_LEGACY + recId;
  }
}

export function buildRawHexSignature(
  r: Uint8Array,
  s: Uint8Array,
  v: number,
): string {
  const paddedR = pad32(r);
  const paddedS = pad32(s);
  const vBytes = encodeV(v);
  let hex = '0x';
  for (const part of [paddedR, paddedS, vBytes]) {
    for (const byte of part) {
      hex += byte.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

export function buildRawEthHexSignature(
  result: Uint8Array,
  hash: Uint8Array,
  dataType: number | undefined,
  chainId: number | undefined,
  signData?: string,
): string {
  const sig = new Keycard.RecoverableSignature({
    hash,
    tlvData: hexToBytes(ensureHexPrefix(bytesToHex(result))),
  });
  const v = computeEthV(sig.recId!, dataType, chainId, detectTxType(signData));
  return buildRawHexSignature(sig.r!, sig.s!, v);
}

export function buildEthSignatureURFromResult(
  result: Uint8Array,
  hash: Uint8Array,
  dataType: number | undefined,
  chainId: number | undefined,
  requestId: string | undefined,
  signData?: string,
): string {
  return buildEthSignatureUR(
    bytesToHex(result),
    hash,
    dataType,
    chainId,
    requestId,
    detectTxType(signData),
  );
}

export function buildEthSignatureUR(
  signRespDataHex: string,
  hash: Uint8Array,
  dataType: number | undefined,
  chainId: number | undefined,
  requestId: string | undefined,
  txType?: number,
): string {
  const sig = new Keycard.RecoverableSignature({
    hash,
    tlvData: hexToBytes(ensureHexPrefix(signRespDataHex)),
  });

  const recId = sig.recId!;
  const r = pad32(sig.r!);
  const s = pad32(sig.s!);
  const v = computeEthV(recId, dataType, chainId, txType);

  const sigBytes = new Uint8Array(r.length + s.length + encodeV(v).length);
  sigBytes.set(r, 0);
  sigBytes.set(s, r.length);
  sigBytes.set(encodeV(v), r.length + s.length);

  const requestIdBuf = requestId
    ? Buffer.from(requestId.replace(/-/g, ''), 'hex')
    : undefined;
  const ethSig = new ETHSignature(
    Buffer.from(sigBytes),
    requestIdBuf,
    'GapSign',
  );
  return ethSig.toUREncoder(1000).nextPart();
}
