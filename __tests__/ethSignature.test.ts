/* eslint-disable no-bitwise */
import * as secp from '@noble/secp256k1';
import { URDecoder } from '@ngraveio/bc-ur';
import CBOR from 'cbor-sync';
import {
  buildEthSignatureUR,
  buildEthSignatureURFromResult,
  buildRawEthHexSignature,
  buildRawHexSignature,
  computeEthV,
} from '../src/utils/ethSignature';

// ── TLV builder helpers ──────────────────────────────────────────────────────

function tlvEncode(tag: number, value: Uint8Array): Uint8Array {
  const len = value.length;
  let header: Uint8Array;
  if (len < 0x80) {
    header = new Uint8Array([tag, len]);
  } else if (len < 0x100) {
    header = new Uint8Array([tag, 0x81, len]);
  } else {
    header = new Uint8Array([tag, 0x82, (len >> 8) & 0xff, len & 0xff]);
  }
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(value, header.length);
  return out;
}

function derInt(n: Uint8Array): Uint8Array {
  let start = 0;
  while (start < n.length - 1 && n[start] === 0) {
    start++;
  }
  const trimmed = n.slice(start);
  if (trimmed[0] >= 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded[0] = 0x00;
    padded.set(trimmed, 1);
    return tlvEncode(0x02, padded);
  }
  return tlvEncode(0x02, trimmed);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function buildSignatureTLV(
  pubKey: Uint8Array,
  r: Uint8Array,
  s: Uint8Array,
): string {
  const sequence = tlvEncode(0x30, concatBytes(derInt(r), derInt(s)));
  const inner = concatBytes(tlvEncode(0x80, pubKey), sequence);
  const template = tlvEncode(0xa0, inner);
  return Array.from(template)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Decode a single-part UR string back to a CBOR map ───────────────────────

function decodeUR(urString: string): Record<number, any> {
  const decoder = new URDecoder();
  decoder.receivePart(urString);
  return CBOR.decode(decoder.resultUR().cbor);
}

// ── Shared test fixture ──────────────────────────────────────────────────────

// Private key = 1 (smallest valid secp256k1 scalar)
const PRIV_KEY = new Uint8Array(32);
PRIV_KEY[31] = 1;

const HASH = new Uint8Array(32).fill(0xab);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildEthSignatureUR', () => {
  let tlvHex: string;
  let recId: number;

  beforeAll(async () => {
    // signAsync uses WebCrypto HMAC-SHA256 (available in Node 18+).
    // format: 'recovered' returns [recId(1), r(32), s(32)] = 65 bytes.
    // extraEntropy: false makes signing deterministic (RFC6979).
    const sigBytes = await secp.signAsync(HASH, PRIV_KEY, {
      prehash: false,
      format: 'recovered',
      extraEntropy: false,
    });
    recId = sigBytes[0];
    const r = sigBytes.slice(1, 33);
    const s = sigBytes.slice(33, 65);
    const pubKey = secp.getPublicKey(PRIV_KEY, false); // 65-byte uncompressed
    tlvHex = buildSignatureTLV(pubKey, r, s);
  });

  it('returns a ur:eth-signature string', () => {
    const ur = buildEthSignatureUR(
      tlvHex,
      HASH,
      'tx-eip1559',
      undefined,
      undefined,
    );
    expect(ur.toLowerCase()).toMatch(/^ur:eth-signature\//);
  });

  describe('v calculation by payload kind', () => {
    it('tx-eip1559: v equals recId (0 or 1)', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-eip1559',
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(recId);
    });

    it('tx-legacy (chainId=1): v = 37 + recId', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 'tx-legacy', 1, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(37 + recId);
    });

    it('encodes multi-byte legacy v values', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 'tx-legacy', 111, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toEqual(Buffer.from([0x01, 0x01 + recId]));
    });

    it('encodes three-byte legacy v values', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-legacy',
        40_000,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toHaveLength(3);
      expect(sig.readUIntBE(64, 3)).toBe(80_035 + recId);
    });

    it('encodes four-byte legacy v values', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-legacy',
        9_000_000,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toHaveLength(4);
      expect(sig.readUInt32BE(64)).toBe(18_000_035 + recId);
    });

    it('eip712-json: v = 27 + recId', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'eip712-json',
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('personal-message: v = 27 + recId', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'personal-message',
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('raw-digest: v = 27 + recId', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'raw-digest',
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('tx-eip2930 (chainId=1): v equals recId, not EIP-155', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 'tx-eip2930', 1, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(recId);
      expect(sig[sig.length - 1]).not.toBe(37 + recId);
    });

    it('eip712-prehashed: v = 27 + recId', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'eip712-prehashed',
        1,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });
  });

  describe('CBOR map structure', () => {
    it('always includes signature (key 2) and origin "Keycard Pal" (key 3)', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-eip1559',
        undefined,
        undefined,
      );
      const decoded = decodeUR(ur);
      expect(Buffer.isBuffer(decoded[2])).toBe(true);
      expect(decoded[3]).toBe('Keycard Pal');
    });

    it('signature is 65 bytes (r || s || v) for single-byte v values', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-eip1559',
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.length).toBe(65);
    });

    it('includes requestId (key 1) when provided', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-eip1559',
        undefined,
        '0102030405060708090a0b0c0d0e0f10',
      );
      const decoded = decodeUR(ur);
      expect(decoded[1]).toBeDefined();
    });

    it('omits requestId (key 1) when not provided', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        'tx-eip1559',
        undefined,
        undefined,
      );
      const decoded = decodeUR(ur);
      expect(decoded[1]).toBeUndefined();
    });
  });

  it('throws on malformed TLV', () => {
    expect(() =>
      buildEthSignatureUR('deadbeef', HASH, 'tx-eip1559', undefined, undefined),
    ).toThrow();
  });
});

describe('computeEthV', () => {
  it('tx-eip2930: returns recId regardless of chainId', () => {
    expect(computeEthV(0, 'tx-eip2930', 1)).toBe(0);
    expect(computeEthV(1, 'tx-eip2930', 1)).toBe(1);
  });

  it('tx-eip1559: returns recId', () => {
    expect(computeEthV(0, 'tx-eip1559', 1)).toBe(0);
    expect(computeEthV(1, 'tx-eip1559', 1)).toBe(1);
  });

  it('tx-legacy: v = 35 + 2*chainId + recId', () => {
    expect(computeEthV(0, 'tx-legacy', 1)).toBe(37);
    expect(computeEthV(1, 'tx-legacy', 1)).toBe(38);
    expect(computeEthV(0, 'tx-legacy', 137)).toBe(35 + 274);
  });

  it('tx-legacy with no chainId: v = 35 + recId', () => {
    expect(computeEthV(0, 'tx-legacy', undefined)).toBe(35);
    expect(computeEthV(1, 'tx-legacy', undefined)).toBe(36);
  });

  it('personal-message: v = 27 + recId', () => {
    expect(computeEthV(0, 'personal-message', undefined)).toBe(27);
    expect(computeEthV(1, 'personal-message', undefined)).toBe(28);
  });

  it('eip712-json and eip712-prehashed: v = 27 + recId', () => {
    expect(computeEthV(0, 'eip712-json', undefined)).toBe(27);
    expect(computeEthV(1, 'eip712-prehashed', undefined)).toBe(28);
  });

  it('raw-digest: v = 27 + recId', () => {
    expect(computeEthV(0, 'raw-digest', undefined)).toBe(27);
    expect(computeEthV(1, 'raw-digest', undefined)).toBe(28);
  });

  it('invalid: throws', () => {
    expect(() => computeEthV(0, 'invalid', undefined)).toThrow();
  });
});

describe('buildRawEthHexSignature', () => {
  let tlvBytes: Uint8Array;
  let recId: number;

  beforeAll(async () => {
    const sigBytes = await secp.signAsync(HASH, PRIV_KEY, {
      prehash: false,
      format: 'recovered',
      extraEntropy: false,
    });
    recId = sigBytes[0];
    const r = sigBytes.slice(1, 33);
    const s = sigBytes.slice(33, 65);
    const pubKey = secp.getPublicKey(PRIV_KEY, false);
    const hex = buildSignatureTLV(pubKey, r, s);
    tlvBytes = new Uint8Array(Buffer.from(hex, 'hex'));
  });

  it('returns 0x-prefixed hex of length 132 (single-byte v)', () => {
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      'tx-eip1559',
      undefined,
    );
    expect(result).toMatch(/^0x[0-9a-f]{130}$/);
  });

  it('v = recId for tx-eip1559', () => {
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      'tx-eip1559',
      undefined,
    );
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
  });

  it('v = recId for tx-eip2930 even with a chainId', () => {
    const result = buildRawEthHexSignature(tlvBytes, HASH, 'tx-eip2930', 1);
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
  });

  it('v = 27 + recId for personal-message', () => {
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      'personal-message',
      undefined,
    );
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(27 + recId);
  });

  it('v = 27 + recId for raw-digest (WC typed-data digest)', () => {
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      'raw-digest',
      undefined,
    );
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(27 + recId);
  });
});

describe('buildEthSignatureURFromResult', () => {
  let tlvBytes: Uint8Array;

  beforeAll(async () => {
    const sigBytes = await secp.signAsync(HASH, PRIV_KEY, {
      prehash: false,
      format: 'recovered',
      extraEntropy: false,
    });
    const r = sigBytes.slice(1, 33);
    const s = sigBytes.slice(33, 65);
    const pubKey = secp.getPublicKey(PRIV_KEY, false);
    const hex = buildSignatureTLV(pubKey, r, s);
    tlvBytes = new Uint8Array(Buffer.from(hex, 'hex'));
  });

  it('returns a ur:eth-signature string', () => {
    const ur = buildEthSignatureURFromResult(
      tlvBytes,
      HASH,
      'tx-eip1559',
      undefined,
      undefined,
    );
    expect(ur.toLowerCase()).toMatch(/^ur:eth-signature\//);
  });

  it('passes requestId through to the UR', () => {
    const ur = buildEthSignatureURFromResult(
      tlvBytes,
      HASH,
      'tx-eip1559',
      undefined,
      '0102030405060708090a0b0c0d0e0f10',
    );
    const decoded = decodeUR(ur);
    expect(decoded[1]).toBeDefined();
  });

  it('tx-eip2930 kind yields v = recId in the UR signature', () => {
    const ur = buildEthSignatureURFromResult(
      tlvBytes,
      HASH,
      'tx-eip2930',
      1,
      undefined,
    );
    const sig: Buffer = decodeUR(ur)[2];
    // EIP-2930 → v = recId (0 or 1), not 37+
    expect(sig[sig.length - 1]).toBeLessThanOrEqual(1);
  });
});

describe('buildRawHexSignature', () => {
  const r32 = new Uint8Array(32).fill(0xaa);
  const s32 = new Uint8Array(32).fill(0xbb);

  it('returns 0x-prefixed hex string', () => {
    const result = buildRawHexSignature(r32, s32, 27);
    expect(result).toMatch(/^0x[0-9a-f]+$/i);
  });

  it('is 132 chars (0x + 64 r + 64 s + 2 v) for single-byte v', () => {
    const result = buildRawHexSignature(r32, s32, 27);
    expect(result).toHaveLength(2 + 64 + 64 + 2);
  });

  it('pads r and s to 32 bytes', () => {
    const shortR = new Uint8Array(1).fill(0x01);
    const shortS = new Uint8Array(1).fill(0x02);
    const result = buildRawHexSignature(shortR, shortS, 27);
    // r should be left-padded: 31 zero bytes + 0x01
    expect(result.slice(2, 2 + 64)).toBe('0'.repeat(62) + '01');
    // s should be left-padded: 31 zero bytes + 0x02
    expect(result.slice(2 + 64, 2 + 128)).toBe('0'.repeat(62) + '02');
  });

  it('encodes v correctly in the last byte(s)', () => {
    const result = buildRawHexSignature(r32, s32, 28);
    expect(result.slice(2 + 128)).toBe('1c');
  });

  it('encodes multi-byte v values', () => {
    // v = 0x0101 = 257
    const result = buildRawHexSignature(r32, s32, 0x0101);
    expect(result.slice(2 + 128)).toBe('0101');
  });
});
