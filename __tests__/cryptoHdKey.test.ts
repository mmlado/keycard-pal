import { URDecoder } from '@ngraveio/bc-ur';
import CBOR from 'cbor-sync';

import { buildCryptoHdKeyUR } from '../src/utils/cryptoHdKey';

/* eslint-disable no-bitwise */
// Mock keycard-sdk so tests work with synthetic (non-curve-valid) public keys
jest.mock('keycard-sdk', () => ({
  BIP32KeyPair: {
    fromTLV: (data: Uint8Array) => {
      let pos = 2;
      if (data[1] === 0x81) pos = 3;
      const pubLen = data[pos + 1];
      const pubKey = data.slice(pos + 2, pos + 2 + pubLen);
      pos += 2 + pubLen;
      const chainLen = data[pos + 1];
      const chainCode = data.slice(pos + 2, pos + 2 + chainLen);
      return { publicKey: pubKey, chainCode };
    },
  },
  CryptoUtils: {
    compressPublicKey: (pub: Uint8Array) => {
      const prefix = (pub[64] & 1) === 0 ? 0x02 : 0x03;
      const out = new Uint8Array(33);
      out[0] = prefix;
      out.set(pub.slice(1, 33), 1);
      return out;
    },
  },
}));

// ---------------------------------------------------------------------------
// TLV builder helpers (mirrors the Keycard card response format)
// ---------------------------------------------------------------------------

function tlvEncode(tag: number, data: Uint8Array): Uint8Array {
  const len = data.length;
  let header: Uint8Array;
  if (len < 0x80) {
    header = new Uint8Array([tag, len]);
  } else {
    header = new Uint8Array([tag, 0x81, len]);
  }
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(data, header.length);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Build a mock Keycard exportKey TLV response:
 *   0xa1 (constructed) {
 *     0x80  pubkey   (65 bytes, uncompressed: 0x04 || x || y)
 *     0x82  chainCode (32 bytes)
 *   }
 */
function buildExportKeyTLV(
  pubKey: Uint8Array,
  chainCode: Uint8Array,
): Uint8Array {
  const inner = concat(tlvEncode(0x80, pubKey), tlvEncode(0x82, chainCode));
  return tlvEncode(0xa1, inner);
}

// ---------------------------------------------------------------------------
// Decode a single-part UR string back to CBOR
// ---------------------------------------------------------------------------

function decodeUR(urString: string): Record<number, any> {
  const decoder = new URDecoder();
  decoder.receivePart(urString);
  return CBOR.decode(decoder.resultUR().cbor);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A minimal valid uncompressed public key (prefix 0x04, x=1, y=0 → even → prefix 0x02)
const PUB_KEY_UNCOMPRESSED = new Uint8Array(65);
PUB_KEY_UNCOMPRESSED[0] = 0x04;
PUB_KEY_UNCOMPRESSED[32] = 0x01; // x[31] = 1

const CHAIN_CODE = new Uint8Array(32).fill(0xcc);

const DERIVATION_PATH = "m/44'/60'/0'";
const SOURCE_FINGERPRINT = 0xdeadbeef;
const PARENT_FINGERPRINT = 0xcafebabe;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCryptoHdKeyUR', () => {
  let tlvData: Uint8Array;

  beforeAll(() => {
    tlvData = buildExportKeyTLV(PUB_KEY_UNCOMPRESSED, CHAIN_CODE);
  });

  it('returns a ur:crypto-hdkey string', () => {
    const ur = buildCryptoHdKeyUR(
      tlvData,
      DERIVATION_PATH,
      SOURCE_FINGERPRINT,
      PARENT_FINGERPRINT,
    );
    expect(ur).toMatch(/^ur:crypto-hdkey\//);
  });

  describe('CBOR structure', () => {
    let decoded: Record<number, any>;

    beforeAll(() => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
      );
      decoded = decodeUR(ur);
    });

    it('key 2 (is-private) is false or absent (defaults to false)', () => {
      expect(decoded[2] ?? false).toBe(false);
    });

    it('key 3 (key-data) is a 33-byte compressed public key', () => {
      expect(Buffer.isBuffer(decoded[3])).toBe(true);
      expect(decoded[3].length).toBe(33);
    });

    it('key 3 (key-data) starts with 0x02 (even y)', () => {
      // PUB_KEY_UNCOMPRESSED has y = all zeros (even), so prefix = 0x02
      expect(decoded[3][0]).toBe(0x02);
    });

    it('key 4 (chain-code) matches the input chain code', () => {
      expect(Buffer.isBuffer(decoded[4])).toBe(true);
      expect(decoded[4].length).toBe(32);
      expect(Array.from(decoded[4] as Buffer)).toEqual(Array.from(CHAIN_CODE));
    });

    it('key 6 (origin) is defined (crypto-keypath)', () => {
      expect(decoded[6]).toBeDefined();
    });

    it('origin includes a source fingerprint', () => {
      const origin = decoded[6];
      const keypathMap = origin?.value ?? origin;
      expect(keypathMap[2]).toBe(SOURCE_FINGERPRINT);
    });

    it('key 8 (parent-fingerprint) matches PARENT_FINGERPRINT', () => {
      expect(decoded[8]).toBe(PARENT_FINGERPRINT);
    });

    it('key 9 (name) is "Keycard Pal"', () => {
      expect(decoded[9]).toBe('Keycard Pal');
    });
  });

  describe('derivation path encoding', () => {
    it("encodes m/44'/60'/0' with correct depth", () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
      );
      const decoded = decodeUR(ur);
      // The origin (key 6) is a CBOR tagged value (tag 304).
      // cbor-sync decodes tags as {tag, value} or unwraps them — check depth field (key 3).
      const origin = decoded[6];
      // Depth = 3 components (44', 60', 0')
      const keypathMap = origin?.value ?? origin;
      expect(keypathMap[3]).toBe(3);
    });

    it('encodes a non-hardened path correctly', () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        'm/0/1',
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
      );
      const decoded = decodeUR(ur);
      const origin = decoded[6];
      const keypathMap = origin?.value ?? origin;
      expect(keypathMap[3]).toBe(2); // depth = 2
    });
  });

  describe('source / note field', () => {
    it('encodes the source string in key 10 (note) when provided', () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
        'account.ledger_live',
      );
      const decoded = decodeUR(ur);
      expect(decoded[10]).toBe('account.ledger_live');
    });

    it('encodes a children keypath in key 7 for account.ledger_legacy', () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
        'account.ledger_legacy',
      );
      const decoded = decodeUR(ur);
      expect(decoded[7]).toBeDefined();
    });

    it('omits key 7 (children) for non-legacy sources', () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
        'account.ledger_live',
      );
      const decoded = decodeUR(ur);
      expect(decoded[7]).toBeUndefined();
    });

    it('omits key 10 (note) when source is not provided', () => {
      const ur = buildCryptoHdKeyUR(
        tlvData,
        DERIVATION_PATH,
        SOURCE_FINGERPRINT,
        PARENT_FINGERPRINT,
      );
      const decoded = decodeUR(ur);
      expect(decoded[10]).toBeUndefined();
    });
  });
});
