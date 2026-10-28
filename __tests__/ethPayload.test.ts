import { RLP } from '@ethereumjs/rlp';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { hashTypedData } from 'viem';

import { getChainName } from '../src/utils/chainMetadata';
import {
  classifyEthPayload,
  payloadChainId,
  payloadTransaction,
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

// Chain 1, nonce 0, a transfer of nothing to 0xaabb…ccdd.
const LEGACY_TX_HEX =
  'e380843b9aca0082520894aabbccddeeff00112233445566778899aabbccdd8080018080';
const EIP2930_TX_HEX =
  '01de01800182520894aabbccddeeff00112233445566778899aabbccdd8080c0';
const EIP1559_TX_HEX =
  '02df0180010182520894aabbccddeeff00112233445566778899aabbccdd8080c0';

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
function typedDataHex(typed: object): string {
  return '0x' + Buffer.from(JSON.stringify(typed), 'utf8').toString('hex');
}
const TYPED_DATA_JSON_HEX = typedDataHex(TYPED_DATA);

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

  it('dataType=2 typed data that names no primaryType → invalid', () => {
    const unnamed = {
      domain: TYPED_DATA.domain,
      types: TYPED_DATA.types,
      message: TYPED_DATA.message,
    };
    expect(classifyEthPayload(typedDataHex(unnamed), 2)).toEqual({
      kind: 'invalid',
      reason: 'EIP-712 typed data names no primaryType.',
    });
  });

  it('dataType=2 with domain fields the declared EIP712Domain leaves out → invalid', () => {
    const typed = {
      ...TYPED_DATA,
      types: {
        ...TYPED_DATA.types,
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'verifyingContract', type: 'address' },
        ],
      },
    };
    expect(classifyEthPayload(typedDataHex(typed), 2)).toEqual({
      kind: 'invalid',
      reason:
        'The EIP-712 domain has fields the signature would not cover: version, chainId.',
    });
  });

  describe('a declared EIP712Domain other than the standard fields with their types', () => {
    const STANDARD_DOMAIN = [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ];
    function declaring(retyped: Record<string, string>) {
      return typedDataHex({
        ...TYPED_DATA,
        types: {
          ...TYPED_DATA.types,
          EIP712Domain: STANDARD_DOMAIN.map(m => ({
            ...m,
            type: retyped[m.name] ?? m.type,
          })),
        },
      });
    }

    it.each([
      ['verifyingContract', 'string', 'address'],
      ['verifyingContract', 'bytes', 'address'],
      ['chainId', 'string', 'uint256'],
      ['version', 'uint256', 'string'],
    ])('refuses %s declared as %s', (field, type, standard) => {
      expect(classifyEthPayload(declaring({ [field]: type }), 2)).toEqual({
        kind: 'invalid',
        reason: `The EIP-712 domain declares ${field} as ${type} instead of ${standard}, so the signature would not be valid on the contract it names.`,
      });
    });

    it('names every retyped field', () => {
      const payload = classifyEthPayload(
        declaring({ chainId: 'string', verifyingContract: 'string' }),
        2,
      );
      expect(payload.kind === 'invalid' && payload.reason).toBe(
        'The EIP-712 domain declares chainId as string instead of uint256, verifyingContract as string instead of address, so the signature would not be valid on the contract it names.',
      );
    });

    function declaringMembers(members: unknown[], domain: object = {}) {
      return typedDataHex({
        ...TYPED_DATA,
        domain: { ...TYPED_DATA.domain, ...domain },
        types: { ...TYPED_DATA.types, EIP712Domain: members },
      });
    }

    it.each([
      [
        'a standard field twice',
        [...STANDARD_DOMAIN, { name: 'verifyingContract', type: 'address' }],
        {},
        'verifyingContract twice',
      ],
      [
        'a field whose name is not a string',
        [
          ...STANDARD_DOMAIN.slice(0, 3),
          { name: ['verifyingContract'], type: 'string' },
        ],
        {},
        'a field without a name and a type',
      ],
      [
        'a field EIP-712 does not define',
        [...STANDARD_DOMAIN, { name: 'foo', type: 'string' }],
        { foo: 'x' },
        'foo, which EIP-712 does not define',
      ],
      [
        'an EIP712Domain that is not a list',
        {},
        {},
        'an EIP712Domain that is not a list',
      ],
    ])('refuses %s', (_, members, domain, declared) => {
      const payload = classifyEthPayload(
        declaringMembers(members as unknown[], domain),
        2,
      );
      expect(payload).toEqual({
        kind: 'invalid',
        reason: `The EIP-712 domain declares ${declared}, so the signature would not be valid on the contract it names.`,
      });
    });

    it('signs the standard fields in another order', () => {
      expect(
        classifyEthPayload(declaringMembers([...STANDARD_DOMAIN].reverse()), 2)
          .kind,
      ).toBe('eip712-json');
    });

    it('signs the standard types, declared or not', () => {
      expect(classifyEthPayload(declaring({}), 2).kind).toBe('eip712-json');
      expect(classifyEthPayload(TYPED_DATA_JSON_HEX, 2).kind).toBe(
        'eip712-json',
      );
    });
  });

  it('dataType=2 typed data whose domain is not an object → invalid, not an empty domain', () => {
    const typed = { ...TYPED_DATA, domain: 'x' };
    expect(classifyEthPayload(typedDataHex(typed), 2).kind).toBe('invalid');
  });

  // Without a declared EIP712Domain, viem hashes chainId only when it is a number.
  it('dataType=2 with a domain field viem leaves out of the type it derives → invalid', () => {
    const typed = {
      ...TYPED_DATA,
      domain: { ...TYPED_DATA.domain, chainId: '1' },
    };
    expect(classifyEthPayload(typedDataHex(typed), 2)).toEqual({
      kind: 'invalid',
      reason:
        'The EIP-712 domain has fields the signature would not cover: chainId.',
    });
  });

  it('dataType=2 with 47 junk bytes → invalid', () => {
    expect(classifyEthPayload('ee'.repeat(47), 2).kind).toBe('invalid');
  });

  it('dataType=0 with a 32-byte digest → raw-digest (a QR request carrying the digest)', () => {
    expect(classifyEthPayload(DIGEST_32_HEX, 0)).toEqual({
      kind: 'raw-digest',
      digest: DIGEST_32_HEX,
    });
  });

  it.each([5, 99])(
    'dataType=%i with a 32-byte payload → invalid, not a digest',
    dataType => {
      expect(classifyEthPayload(DIGEST_32_HEX, dataType)).toEqual({
        kind: 'invalid',
        reason: `Unknown data type ${dataType}.`,
      });
    },
  );

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

const n = (v: number) => {
  const h = v.toString(16);
  return v === 0
    ? new Uint8Array()
    : Buffer.from(h.length % 2 ? `0${h}` : h, 'hex');
};
const TO = Buffer.from('aabbccddeeff00112233445566778899aabbccdd', 'hex');
const enc = (fields: unknown[]) =>
  Buffer.from(RLP.encode(fields as never)).toString('hex');
const eip1559 = (chain: number) =>
  '02' + enc([n(chain), n(0), n(1), n(1), n(21000), TO, n(0), n(0), []]);
const eip2930 = (chain: number) =>
  '01' + enc([n(chain), n(0), n(1), n(21000), TO, n(0), n(0), []]);
const legacy155 = (chain: number) =>
  enc([n(0), n(1), n(21000), TO, n(0), n(0), n(chain), n(0), n(0)]);

describe('the transactions it accepts', () => {
  it('decodes the fields the review shows', () => {
    const data = Buffer.from('a9059cbb', 'hex');
    const legacy = enc([
      n(7),
      n(2),
      n(21000),
      TO,
      n(5),
      data,
      n(1),
      n(0),
      n(0),
    ]);
    expect(payloadTransaction(classifyEthPayload(legacy, 1))).toEqual({
      gasLimit: 21000n,
      to: new Uint8Array(TO),
      value: 5n,
      data: new Uint8Array(data),
      fees: { kind: 'legacy', gasPrice: 2n },
    });
    const typed =
      '02' + enc([n(1), n(3), n(4), n(9), n(21000), TO, n(0), n(0), []]);
    expect(payloadTransaction(classifyEthPayload(typed, 4))).toMatchObject({
      fees: { kind: 'eip1559', maxPriorityFeePerGas: 4n, maxFeePerGas: 9n },
    });
  });

  it('accepts a contract creation, whose recipient is empty', () => {
    const creation =
      '02' + enc([n(1), n(0), n(1), n(1), n(21000), n(0), n(0), n(0), []]);
    expect(classifyEthPayload(creation, 4).kind).toBe('tx-eip1559');
  });

  it.each([
    ['bytes that are not RLP', '02f8', 4, 'The transaction is not valid RLP.'],
    [
      'bytes left over after the RLP',
      legacy155(1) + '00',
      1,
      'The transaction is not valid RLP.',
    ],
    ['an RLP string', '0282abcd', 4, 'The transaction is not an RLP list.'],
    [
      'an EIP-1559 transaction with 8 fields',
      '02' + enc([n(1), n(0), n(1), n(1), n(21000), TO, n(0), n(0)]),
      4,
      'An EIP-1559 transaction has 9 fields, this one has 8.',
    ],
    [
      'an EIP-2930 transaction with 9 fields',
      '01' + enc([n(1), n(0), n(1), n(21000), TO, n(0), n(0), [], n(0)]),
      1,
      'An EIP-2930 transaction has 8 fields, this one has 9.',
    ],
    [
      'a legacy transaction with 7 fields',
      enc([n(0), n(1), n(21000), TO, n(0), n(0), n(1)]),
      1,
      'A legacy transaction has 9 fields, this one has 7.',
    ],
    [
      'a list where a value belongs',
      enc([[], n(1), n(21000), TO, n(0), n(0), n(1), n(0), n(0)]),
      1,
      'A transaction field holds a list where a value belongs.',
    ],
    [
      "qrkit's demo EIP-1559 transaction",
      '02e80180843b9aca008504a817c800825208940000000000000000000000000000000000000000010180c0',
      4,
      'The transaction is not valid RLP.',
    ],
    [
      'an access list that is not a list',
      '02' + enc([n(1), n(0), n(1), n(1), n(21000), TO, n(0), n(0), n(0)]),
      4,
      'The access list of the transaction is not a list.',
    ],
    [
      'a legacy transaction with an r',
      enc([n(0), n(1), n(21000), TO, n(0), n(0), n(1), n(1), n(0)]),
      1,
      'An EIP-155 legacy transaction ends with an empty r and s, and this one does not.',
    ],
    [
      'a legacy transaction with an s',
      enc([n(0), n(1), n(21000), TO, n(0), n(0), n(1), n(0), n(1)]),
      1,
      'An EIP-155 legacy transaction ends with an empty r and s, and this one does not.',
    ],
    [
      'a recipient of 19 bytes',
      '02' +
        enc([n(1), n(0), n(1), n(1), n(21000), TO.subarray(1), n(0), n(0), []]),
      4,
      'The recipient of the transaction is not 20 bytes.',
    ],
  ])('refuses %s', (_, signData, dataType, reason) => {
    const payload = classifyEthPayload(signData, dataType);
    expect(payload).toEqual({ kind: 'invalid', reason });
    expect(payloadTransaction(payload)).toBeUndefined();
  });

  it('keeps a transaction refused for its chain, so its review keeps the rows', () => {
    const payload = classifyEthPayload(eip1559(1), 4, 11155111);
    expect(payload.kind).toBe('invalid');
    expect(payloadTransaction(payload)).toMatchObject({ gasLimit: 21000n });
  });
});

describe('the chain a transaction signs for', () => {
  const legacyPre155 = enc([n(0), n(1), n(21000), TO, n(0), n(0)]);
  const SEPOLIA = 11155111;
  const mismatch = `The transaction is for ${getChainName(
    1,
  )}, but the request says ${getChainName(SEPOLIA)}.`;

  it('reads it from every transaction type that names one', () => {
    expect(classifyEthPayload(eip1559(1), 4, 1)).toMatchObject({
      kind: 'tx-eip1559',
      chainId: 1,
    });
    expect(classifyEthPayload(eip2930(1), 1, 1)).toMatchObject({
      kind: 'tx-eip2930',
      chainId: 1,
    });
    expect(classifyEthPayload(eip2930(1), 4)).toMatchObject({ chainId: 1 });
    expect(classifyEthPayload(legacy155(1), 1, 1)).toMatchObject({
      kind: 'tx-legacy',
      chainId: 1,
    });
  });

  it('refuses a transaction for another chain than the request names', () => {
    for (const [signData, dataType] of [
      [eip1559(1), 4],
      [eip2930(1), 1],
      [eip2930(1), 4],
      [legacy155(1), 1],
    ] as const) {
      expect(classifyEthPayload(signData, dataType, SEPOLIA)).toEqual({
        kind: 'invalid',
        reason: mismatch,
        chainId: 1,
        tx: expect.objectContaining({ to: new Uint8Array(TO) }),
      });
    }
  });

  it("reviews and signs for the transaction's chain when the request names none", () => {
    const payload = classifyEthPayload(eip1559(137), 4);
    expect(payloadChainId(payload, undefined)).toBe(137);
  });

  it('refuses a legacy transaction without EIP-155, which names no chain', () => {
    expect(classifyEthPayload(legacyPre155, 1, 137)).toEqual({
      kind: 'invalid',
      reason:
        'The legacy transaction has no EIP-155 chain ID, so it would be valid on every chain.',
    });
  });

  it('refuses a chain ID past what a number can hold', () => {
    const huge =
      '02' +
      enc([
        Buffer.from('20000000000000', 'hex'),
        n(0),
        n(1),
        n(1),
        n(21000),
        TO,
        n(0),
        n(0),
        [],
      ]);
    expect(classifyEthPayload(huge, 4)).toEqual({
      kind: 'invalid',
      reason: 'The transaction names a chain ID out of range.',
      tx: expect.objectContaining({ to: new Uint8Array(TO) }),
    });
  });

  it('refuses a legacy chain ID whose v would not be an exact number', () => {
    const limit = (Number.MAX_SAFE_INTEGER - 37) / 2;
    expect(classifyEthPayload(legacy155(limit), 1)).toMatchObject({
      kind: 'tx-legacy',
      chainId: limit,
    });
    expect(classifyEthPayload(legacy155(limit + 1), 1)).toMatchObject({
      kind: 'invalid',
      reason: 'The transaction names a chain ID out of range.',
    });
  });
});

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

  it('dataType=0 digest starting 0x02', () => {
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
