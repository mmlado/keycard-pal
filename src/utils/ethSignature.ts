/* eslint-disable no-bitwise */
import { ETHSignature } from '@keystonehq/bc-ur-registry-eth';
import Keycard from 'keycard-sdk';
import { hexToBytes } from 'viem';

import { APP_NAME } from '@/constants/app';
import type { EthPayloadKind } from './ethPayload';
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

export function computeEthV(
  recId: number,
  kind: EthPayloadKind,
  chainId: number | undefined,
): number {
  if (kind === 'invalid') {
    throw new Error('Cannot compute v for an invalid payload');
  }
  if (kind === 'tx-eip2930' || kind === 'tx-eip1559') {
    return recId;
  }
  if (kind === 'tx-legacy') {
    return V_BASE_EIP155 + 2 * (chainId ?? 0) + recId;
  }
  return V_BASE_LEGACY + recId;
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
  kind: EthPayloadKind,
  chainId: number | undefined,
): string {
  const sig = new Keycard.RecoverableSignature({
    hash,
    tlvData: hexToBytes(ensureHexPrefix(bytesToHex(result))),
  });
  const v = computeEthV(sig.recId!, kind, chainId);
  return buildRawHexSignature(sig.r!, sig.s!, v);
}

export function buildEthSignatureURFromResult(
  result: Uint8Array,
  hash: Uint8Array,
  kind: EthPayloadKind,
  chainId: number | undefined,
  requestId: string | undefined,
): string {
  return buildEthSignatureUR(
    bytesToHex(result),
    hash,
    kind,
    chainId,
    requestId,
  );
}

export function buildEthSignatureUR(
  signRespDataHex: string,
  hash: Uint8Array,
  kind: EthPayloadKind,
  chainId: number | undefined,
  requestId: string | undefined,
): string {
  const sig = new Keycard.RecoverableSignature({
    hash,
    tlvData: hexToBytes(ensureHexPrefix(signRespDataHex)),
  });

  const recId = sig.recId!;
  const r = pad32(sig.r!);
  const s = pad32(sig.s!);
  const v = computeEthV(recId, kind, chainId);

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
    APP_NAME,
  );
  return ethSig.toUREncoder(1000).nextPart();
}
