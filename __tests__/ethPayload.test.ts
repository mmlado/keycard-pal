import { keccak_256 } from '@noble/hashes/sha3.js';
import { hashTypedData } from 'viem';

import {
  classifyEthPayload,
  signingDigest,
  type EthPayload,
} from '../src/utils/ethPayload';
import { computeEthV } from '../src/utils/ethSignature';
import {
  computeEip712DigestFromJson,
  computeEip712DigestFromPrehashed,
} from '../src/utils/erc8213';

function hex(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex');
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal legacy tx: RLP list first byte (>= 0xc0). Classification only
// inspects the first byte; scan-time validation (parseTx) guards structure.
const LEGACY_TX_HEX =
  'e980843b9aca0082520894aabbccddeeff00112233445566778899aabbccdd8080018080';
const EIP2930_TX_HEX =
  '01f85901018082520894aabbccddeeff00112233445566778899aabbccdd8080c0';
const EIP1559_TX_HEX =
  '02f8590101010182520894aabbccddeeff00112233445566778899aabbccdd8080c0';

const TYPED_DATA = {
  domain: {
    name: 'Test',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  primaryType: 'Mail',
  types: {
    Mail: [{ name: 'contents', type: 'string' }],
  },
  message: { contents: 'hi' },
} as const;
const TYPED_DATA_JSON_HEX =
  '0x' + Buffer.from(JSON.stringify(TYPED_DATA), 'utf8').toString('hex');

const DOMAIN_SEPARATOR = '0x' + 'aa'.repeat(32);
const MESSAGE_HASH = '0x' + 'bb'.repeat(32);
const PREHASHED_HEX = '0x1901' + 'aa'.repeat(32) + 'bb'.repeat(32);

const DIGEST_32_HEX = '0x' + 'cd'.repeat(32);

// ── Classification ───────────────────────────────────────────────────────────

describe('classifyEthPayload', () => {
  it('dataType=1 with RLP list first byte → tx-legacy', () => {
    expect(classifyEthPayload(LEGACY_TX_HEX, 1).kind).toBe('tx-legacy');
  });

  it('dataType=1 with 0x01 first byte → tx-eip2930', () => {
    expect(classifyEthPayload(EIP2930_TX_HEX, 1).kind).toBe('tx-eip2930');
  });

  it('dataType=4 with 0x01 first byte → tx-eip2930', () => {
    expect(classifyEthPayload(EIP2930_TX_HEX, 4).kind).toBe('tx-eip2930');
  });

  it('dataType=4 with 0x02 first byte → tx-eip1559', () => {
    expect(classifyEthPayload(EIP1559_TX_HEX, 4).kind).toBe('tx-eip1559');
  });

  it('dataType=1 with 0x02 first byte → invalid (mirrors parseTx accept set)', () => {
    expect(classifyEthPayload(EIP1559_TX_HEX, 1).kind).toBe('invalid');
  });

  it('dataType=4 with RLP list first byte → invalid (mirrors parseTx accept set)', () => {
    expect(classifyEthPayload(LEGACY_TX_HEX, 4).kind).toBe('invalid');
  });

  it('dataType=1 with unrecognized first byte → invalid', () => {
    expect(classifyEthPayload('79aabb', 1).kind).toBe('invalid');
  });

  it('dataType=1 with empty payload → invalid', () => {
    expect(classifyEthPayload('', 1).kind).toBe('invalid');
  });

  it('dataType=3 → personal-message', () => {
    const messageHex = Buffer.from('hello world', 'utf8').toString('hex');
    expect(classifyEthPayload(messageHex, 3).kind).toBe('personal-message');
  });

  it('dataType=3 message starting 0x01 stays personal-message (adversarial first byte)', () => {
    expect(classifyEthPayload('01aabbcc', 3).kind).toBe('personal-message');
  });

  it('dataType=3 → personal-message carrying the ERC-191 digest', () => {
    const messageHex = Buffer.from('hello world', 'utf8').toString('hex');
    const payload = classifyEthPayload(messageHex, 3);
    if (payload.kind !== 'personal-message') throw new Error('unreachable');
    // keccak256("\x19Ethereum Signed Message:\n11hello world")
    expect(payload.digest).toBe(
      '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68',
    );
  });

  it('dataType=3 with bytes that are not UTF-8 still carries a digest', () => {
    const payload = classifyEthPayload('fffe80', 3);
    if (payload.kind !== 'personal-message') throw new Error('unreachable');
    expect(payload.digest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('dataType=2 with full typed-data JSON → eip712-json with the ERC-8213 digest', () => {
    const payload = classifyEthPayload(TYPED_DATA_JSON_HEX, 2);
    expect(payload.kind).toBe('eip712-json');
    if (payload.kind !== 'eip712-json') throw new Error('unreachable');
    expect(payload.digest).toBe(
      computeEip712DigestFromJson(
        TYPED_DATA.domain as Record<string, unknown>,
        TYPED_DATA.message as unknown as Record<string, unknown>,
        TYPED_DATA.primaryType,
        TYPED_DATA.types as unknown as Record<string, unknown>,
      ),
    );
    expect(payload.digest).toBe(hashTypedData(TYPED_DATA));
  });

  it('dataType=2 with 66-byte 0x1901 payload → eip712-prehashed with the final digest', () => {
    const payload = classifyEthPayload(PREHASHED_HEX, 2);
    expect(payload.kind).toBe('eip712-prehashed');
    if (payload.kind !== 'eip712-prehashed') throw new Error('unreachable');
    expect(payload.prehashed.domainSeparatorHash).toBe(DOMAIN_SEPARATOR);
    expect(payload.prehashed.messageHash).toBe(MESSAGE_HASH);
    expect(payload.digest).toBe(
      computeEip712DigestFromPrehashed(DOMAIN_SEPARATOR, MESSAGE_HASH),
    );
  });

  it('dataType=2 with a bare 32-byte digest → raw-digest', () => {
    const payload = classifyEthPayload(DIGEST_32_HEX, 2);
    expect(payload).toEqual({ kind: 'raw-digest', digest: DIGEST_32_HEX });
  });

  it('dataType=2 with unhashable JSON → invalid', () => {
    // primaryType names a type that does not exist → hashTypedData throws
    const junkJson =
      '0x' +
      Buffer.from(
        JSON.stringify({
          domain: {},
          message: {},
          primaryType: 'Mail',
          types: {},
        }),
        'utf8',
      ).toString('hex');
    expect(classifyEthPayload(junkJson, 2).kind).toBe('invalid');
  });

  it('dataType=2 with 47 junk bytes → invalid', () => {
    expect(classifyEthPayload('ee'.repeat(47), 2).kind).toBe('invalid');
  });

  it('dataType=0 with a 32-byte digest → raw-digest (WC typed-data convention)', () => {
    expect(classifyEthPayload(DIGEST_32_HEX, 0)).toEqual({
      kind: 'raw-digest',
      digest: DIGEST_32_HEX,
    });
  });

  it('undefined dataType with a 32-byte digest → raw-digest', () => {
    expect(classifyEthPayload(DIGEST_32_HEX, undefined).kind).toBe(
      'raw-digest',
    );
  });

  it('dataType=0 with a non-32-byte payload → invalid with byte count in the reason', () => {
    const payload = classifyEthPayload('ab'.repeat(31), 0);
    expect(payload.kind).toBe('invalid');
    if (payload.kind !== 'invalid') throw new Error('unreachable');
    expect(payload.reason).toContain('31 bytes');
  });

  it('dataType=0 with a single byte → invalid with singular byte count', () => {
    const payload = classifyEthPayload('ab', 0);
    expect(payload.kind).toBe('invalid');
    if (payload.kind !== 'invalid') throw new Error('unreachable');
    expect(payload.reason).toContain('1 byte');
  });

  it('digest hex is normalized to lowercase with 0x prefix', () => {
    const payload = classifyEthPayload('AB'.repeat(32), 0);
    expect(payload).toEqual({
      kind: 'raw-digest',
      digest: '0x' + 'ab'.repeat(32),
    });
  });

  it('non-hex signData → invalid', () => {
    expect(classifyEthPayload('zz not hex', 0).kind).toBe('invalid');
  });

  it('odd-length hex → invalid', () => {
    expect(classifyEthPayload('abc', 0).kind).toBe('invalid');
  });
});

// ── Signing digest ───────────────────────────────────────────────────────────

describe('signingDigest', () => {
  it('tx kinds: keccak256 of the raw payload', () => {
    for (const [fixture, dataType] of [
      [LEGACY_TX_HEX, 1],
      [EIP2930_TX_HEX, 4],
      [EIP1559_TX_HEX, 4],
    ] as const) {
      const payload = classifyEthPayload(fixture, dataType);
      const expected = keccak_256(new Uint8Array(Buffer.from(fixture, 'hex')));
      expect(hex(signingDigest(payload))).toBe(hex(expected));
    }
  });

  it('personal-message: EIP-191 prefixed keccak256', () => {
    const message = Buffer.from('hello world', 'utf8');
    const payload = classifyEthPayload(message.toString('hex'), 3);
    const prefix = Buffer.from(
      `\x19Ethereum Signed Message:\n${message.length}`,
      'utf8',
    );
    const expected = keccak_256(
      new Uint8Array(Buffer.concat([prefix, message])),
    );
    expect(hex(signingDigest(payload))).toBe(hex(expected));
  });

  it('eip712-json: signs the ERC-8213 digest (not the raw JSON bytes)', () => {
    const payload = classifyEthPayload(TYPED_DATA_JSON_HEX, 2);
    expect(hex(signingDigest(payload))).toBe(hashTypedData(TYPED_DATA));
  });

  it('eip712-prehashed: signs keccak256(0x1901 || domainSeparator || messageHash)', () => {
    const payload = classifyEthPayload(PREHASHED_HEX, 2);
    expect(hex(signingDigest(payload))).toBe(
      computeEip712DigestFromPrehashed(DOMAIN_SEPARATOR, MESSAGE_HASH),
    );
  });

  it('raw-digest: passes the 32 bytes through unchanged', () => {
    const payload = classifyEthPayload(DIGEST_32_HEX, 0);
    expect(hex(signingDigest(payload))).toBe(DIGEST_32_HEX);
  });

  it('always returns exactly 32 bytes for every signable kind', () => {
    const signable: Array<[string, number]> = [
      [LEGACY_TX_HEX, 1],
      [EIP2930_TX_HEX, 4],
      [EIP1559_TX_HEX, 4],
      [Buffer.from('x'.repeat(200), 'utf8').toString('hex'), 3],
      [TYPED_DATA_JSON_HEX, 2],
      [PREHASHED_HEX, 2],
      [DIGEST_32_HEX, 0],
    ];
    for (const [signData, dataType] of signable) {
      expect(
        signingDigest(classifyEthPayload(signData, dataType)),
      ).toHaveLength(32);
    }
  });

  it('throws on invalid payloads', () => {
    const payload: EthPayload = { kind: 'invalid', reason: 'nope' };
    expect(() => signingDigest(payload)).toThrow('nope');
  });
});

// ── The invariant #234 exists for ────────────────────────────────────────────
// The digest displayed in review and the bytes sent to the card come from the
// same classification, so they cannot diverge. The review renders
// payload.digest; the card receives signingDigest(payload).

describe('displayed digest === signed bytes', () => {
  it('personal-message: displayed digest is byte-identical to the signed hash', () => {
    const messageHex = Buffer.from('hello world', 'utf8').toString('hex');
    const payload = classifyEthPayload(messageHex, 3);
    if (payload.kind !== 'personal-message') throw new Error('unreachable');
    expect(hex(signingDigest(payload))).toBe(payload.digest);
  });

  it('eip712-json: displayed digest is byte-identical to the signed hash', () => {
    const payload = classifyEthPayload(TYPED_DATA_JSON_HEX, 2);
    if (payload.kind !== 'eip712-json') throw new Error('unreachable');
    expect(hex(signingDigest(payload))).toBe(payload.digest);
  });

  it('eip712-prehashed: displayed digest is byte-identical to the signed hash', () => {
    const payload = classifyEthPayload(PREHASHED_HEX, 2);
    if (payload.kind !== 'eip712-prehashed') throw new Error('unreachable');
    expect(hex(signingDigest(payload))).toBe(payload.digest);
  });

  it('raw-digest: displayed digest is byte-identical to the signed hash', () => {
    const payload = classifyEthPayload(DIGEST_32_HEX, 0);
    if (payload.kind !== 'raw-digest') throw new Error('unreachable');
    expect(hex(signingDigest(payload))).toBe(payload.digest);
  });
});

// ── Adversarial v regressions ────────────────────────────────────────────────
// Before #234, detectTxType sniffed the first byte of ANY signData, so a
// personal message or WC digest that happened to start 0x01/0x02 flipped v
// from 27+recId to recId. Classification is now gated on dataType.

describe('adversarial first-byte payloads keep v = 27 + recId', () => {
  it('personal message starting 0x01', () => {
    const payload = classifyEthPayload('01aabbcc', 3);
    expect(payload.kind).toBe('personal-message');
    expect(computeEthV(0, payload.kind, 1)).toBe(27);
    expect(computeEthV(1, payload.kind, 1)).toBe(28);
  });

  it('WC typed-data digest starting 0x02', () => {
    const digest = '02' + 'ab'.repeat(31);
    const payload = classifyEthPayload(digest, 0);
    expect(payload.kind).toBe('raw-digest');
    expect(computeEthV(0, payload.kind, 1)).toBe(27);
  });

  it('EIP-712 raw digest starting 0x01 (dataType=2)', () => {
    const digest = '01' + 'cd'.repeat(31);
    const payload = classifyEthPayload(digest, 2);
    expect(payload.kind).toBe('raw-digest');
    expect(computeEthV(1, payload.kind, undefined)).toBe(28);
  });
});
