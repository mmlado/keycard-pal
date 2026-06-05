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
    const ur = buildEthSignatureUR(tlvHex, HASH, 4, undefined, undefined);
    expect(ur.toLowerCase()).toMatch(/^ur:eth-signature\//);
  });

  describe('v calculation by dataType', () => {
    it('EIP-1559 (dataType=4): v equals recId (0 or 1)', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 4, undefined, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(recId);
    });

    it('legacy transaction (dataType=1, chainId=1): v = 37 + recId', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 1, 1, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(37 + recId);
    });

    it('encodes multi-byte legacy v values', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 1, 111, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toEqual(Buffer.from([0x01, 0x01 + recId]));
    });

    it('encodes three-byte legacy v values', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 1, 40_000, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toHaveLength(3);
      expect(sig.readUIntBE(64, 3)).toBe(80_035 + recId);
    });

    it('encodes four-byte legacy v values', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 1, 9_000_000, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.subarray(64)).toHaveLength(4);
      expect(sig.readUInt32BE(64)).toBe(18_000_035 + recId);
    });

    it('EIP-712 (dataType=2): v = 27 + recId', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 2, undefined, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('personal_sign (dataType=3): v = 27 + recId', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 3, undefined, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('undefined dataType falls back to v = 27 + recId', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        undefined,
        undefined,
        undefined,
      );
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(27 + recId);
    });

    it('EIP-2930 (txType=0x01, dataType=1): v equals recId, not EIP-155', () => {
      // Without txType, dataType=1 chainId=1 would give v = 37 + recId
      const ur = buildEthSignatureUR(tlvHex, HASH, 1, 1, undefined, 0x01);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(recId);
      expect(sig[sig.length - 1]).not.toBe(37 + recId);
    });

    it('EIP-1559 (txType=0x02, dataType=4): v equals recId', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 4, 1, undefined, 0x02);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig[sig.length - 1]).toBe(recId);
    });
  });

  describe('CBOR map structure', () => {
    it('always includes signature (key 2) and origin "Keycard Pal" (key 3)', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 4, undefined, undefined);
      const decoded = decodeUR(ur);
      expect(Buffer.isBuffer(decoded[2])).toBe(true);
      expect(decoded[3]).toBe('Keycard Pal');
    });

    it('signature is 65 bytes (r || s || v) for single-byte v values', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 4, undefined, undefined);
      const sig: Buffer = decodeUR(ur)[2];
      expect(sig.length).toBe(65);
    });

    it('includes requestId (key 1) when provided', () => {
      const ur = buildEthSignatureUR(
        tlvHex,
        HASH,
        4,
        undefined,
        '0102030405060708090a0b0c0d0e0f10',
      );
      const decoded = decodeUR(ur);
      expect(decoded[1]).toBeDefined();
    });

    it('omits requestId (key 1) when not provided', () => {
      const ur = buildEthSignatureUR(tlvHex, HASH, 4, undefined, undefined);
      const decoded = decodeUR(ur);
      expect(decoded[1]).toBeUndefined();
    });
  });

  it('throws on malformed TLV', () => {
    expect(() =>
      buildEthSignatureUR('deadbeef', HASH, 4, undefined, undefined),
    ).toThrow();
  });
});

describe('computeEthV', () => {
  it('EIP-2930 (txType=0x01): returns recId regardless of dataType/chainId', () => {
    expect(computeEthV(0, 1, 1, 0x01)).toBe(0);
    expect(computeEthV(1, 1, 1, 0x01)).toBe(1);
  });

  it('EIP-1559 (txType=0x02): returns recId', () => {
    expect(computeEthV(0, 4, 1, 0x02)).toBe(0);
    expect(computeEthV(1, 4, 1, 0x02)).toBe(1);
  });

  it('legacy EIP-155 tx (dataType=1): v = 35 + 2*chainId + recId', () => {
    expect(computeEthV(0, 1, 1, undefined)).toBe(37);
    expect(computeEthV(1, 1, 1, undefined)).toBe(38);
    expect(computeEthV(0, 1, 137, undefined)).toBe(35 + 274);
  });

  it('legacy EIP-155 tx (dataType=1) with no chainId: v = 35 + recId', () => {
    expect(computeEthV(0, 1, undefined, undefined)).toBe(35);
    expect(computeEthV(1, 1, undefined, undefined)).toBe(36);
  });

  it('typed tx without explicit txType (dataType=4): v = recId', () => {
    expect(computeEthV(0, 4, undefined, undefined)).toBe(0);
    expect(computeEthV(1, 4, undefined, undefined)).toBe(1);
  });

  it('personal_sign (dataType=3): v = 27 + recId', () => {
    expect(computeEthV(0, 3, undefined, undefined)).toBe(27);
    expect(computeEthV(1, 3, undefined, undefined)).toBe(28);
  });

  it('EIP-712 (dataType=2): v = 27 + recId', () => {
    expect(computeEthV(0, 2, undefined, undefined)).toBe(27);
    expect(computeEthV(1, 2, undefined, undefined)).toBe(28);
  });

  it('undefined dataType: v = 27 + recId', () => {
    expect(computeEthV(0, undefined, undefined, undefined)).toBe(27);
    expect(computeEthV(1, undefined, undefined, undefined)).toBe(28);
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
    const result = buildRawEthHexSignature(tlvBytes, HASH, 4, undefined);
    expect(result).toMatch(/^0x[0-9a-f]{130}$/);
  });

  it('v = recId for dataType=4', () => {
    const result = buildRawEthHexSignature(tlvBytes, HASH, 4, undefined);
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
  });

  it('v = 27 + recId for dataType=3 (personal_sign)', () => {
    const result = buildRawEthHexSignature(tlvBytes, HASH, 3, undefined);
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(27 + recId);
  });

  it('detects EIP-2930 from 0x-prefixed signData first byte 0x01 → v = recId', () => {
    const result = buildRawEthHexSignature(tlvBytes, HASH, 1, 1, '0x01aabbcc');
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
  });

  it('detects EIP-1559 from signData first byte 0x02 → v = recId', () => {
    const result = buildRawEthHexSignature(tlvBytes, HASH, 4, 1, '02aabbcc');
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
  });

  it('falls back to default v when signData is undefined', () => {
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      3,
      undefined,
      undefined,
    );
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(27 + recId);
  });

  it('non-typed signData (first byte not 0x01/0x02) does not override dataType v', () => {
    // 0xde is not a typed tx prefix → detectTxType returns undefined → uses dataType=4 → v = recId
    const result = buildRawEthHexSignature(
      tlvBytes,
      HASH,
      4,
      undefined,
      '0xdeadbeef',
    );
    const vHex = result.slice(2 + 128);
    expect(parseInt(vHex, 16)).toBe(recId);
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
      4,
      undefined,
      undefined,
    );
    expect(ur.toLowerCase()).toMatch(/^ur:eth-signature\//);
  });

  it('passes requestId through to the UR', () => {
    const ur = buildEthSignatureURFromResult(
      tlvBytes,
      HASH,
      4,
      undefined,
      '0102030405060708090a0b0c0d0e0f10',
    );
    const decoded = decodeUR(ur);
    expect(decoded[1]).toBeDefined();
  });

  it('detects tx type from signData for correct v encoding', () => {
    const ur = buildEthSignatureURFromResult(
      tlvBytes,
      HASH,
      1,
      1,
      undefined,
      '0x01deadbeef',
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
