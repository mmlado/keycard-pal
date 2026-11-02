import { readFileSync } from 'fs';
import { join } from 'path';
import { strToU8, zipSync } from 'fflate';
import { parseSignature, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  canonicalJson,
  checkAttestation,
  descriptorHash,
  EAS_CONTRACT,
  revocationKey,
  TRUSTED_ATTESTERS,
} from '../src/utils/eip7730/attestation';
import { BUNDLED_ATTESTATIONS } from '../src/utils/eip7730/knownAttestations';
import {
  acceptedAttestations,
  indexedFormat,
  processRegistryZip,
  type Eip7730Index,
} from '../src/utils/eip7730/zip';

const CYFRIN = '0x3846c3A30E62075Fa916216b35EF04B8F53931f6';
const ROOT = 'clear-signing-erc7730-registry-master';
const FIXTURES = join(__dirname, 'fixtures', 'eip7730');
const SCHEMA_UID =
  '0xe023eef113c1670774801c34b377fdf612dd8a4d2fa92fe382e15bd91fafb5c2';
const sigName = (name: string, attester = CYFRIN) =>
  `${name}.eip155-1-${attester}.json`;

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const DEPOSIT = '0xd0e30db0';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const TRANSFER_AUTHORIZATION =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)';
const KILN_VAULT = '0x2a4e2dacc45186bed96d9f766cb6be6b0f8a26f1';
const WCT = '0xef4461891dfb3ac8572ccf7c794664a8dd927945';

function fixture(path: string): any {
  return JSON.parse(readFileSync(join(FIXTURES, path), 'utf8'));
}

const FILES: Record<string, string> = {
  'registry/weth/calldata-weth.json': 'registry/weth/calldata-weth.json',
  [`registry/weth/sigs/${sigName(
    'calldata-weth',
  )}`]: `registry/weth/sigs/${sigName('calldata-weth')}`,
  'registry/circle/eip712-TransferWithAuthorization.json':
    'registry/circle/eip712-TransferWithAuthorization.json',
  [`registry/circle/sigs/${sigName(
    'eip712-TransferWithAuthorization',
  )}`]: `registry/circle/sigs/${sigName('eip712-TransferWithAuthorization')}`,
  'registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json':
    'registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json',
  'registry/kiln/common-KilnVaults.json':
    'registry/kiln/common-KilnVaults.json',
  'ercs/calldata-erc4626-vaults.json': 'ercs/calldata-erc4626-vaults.json',
  [`registry/kiln/sigs/${sigName(
    'calldata-Vault-USDC-Morpho-MEV-Capital',
  )}`]: `registry/kiln/sigs/${sigName(
    'calldata-Vault-USDC-Morpho-MEV-Capital',
  )}`,
  'registry/walletconnect/calldata-wct.json':
    'registry/walletconnect/calldata-wct.json',
  [`registry/walletconnect/sigs/${sigName(
    'calldata-wct',
  )}`]: `registry/walletconnect/sigs/${sigName('calldata-wct')}`,
};

function registryFiles(): Record<string, any> {
  const files: Record<string, any> = {
    'specs/erc7730-v2.schema.json': { version: '2.1.0' },
  };
  for (const [name, path] of Object.entries(FILES)) files[name] = fixture(path);
  return files;
}

function zip(files: Record<string, any>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[`${ROOT}/${name}`] = strToU8(
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  }
  return zipSync(entries);
}

function wethFormat(index: Eip7730Index) {
  return indexedFormat(index, 'contracts', 1, WETH, DEPOSIT);
}

function kilnFormat(index: Eip7730Index) {
  const byKey = index.contracts[KILN_VAULT];
  const [key] = Object.keys(byKey);
  return indexedFormat(index, 'contracts', 1, KILN_VAULT, key);
}

describe('canonicalJson', () => {
  it('writes the RFC 8785 example as the RFC does', () => {
    const input = JSON.parse(
      '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],' +
        '"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",' +
        '"literals":[null,true,false]}',
    );
    expect(canonicalJson(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        '"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('sorts keys by UTF-16 code unit, nested ones too', () => {
    expect(canonicalJson({ b: [{ z: 1, a: 2 }], a: '😀', é: 0, Z: -0 })).toBe(
      '{"Z":0,"a":"😀","b":[{"a":2,"z":1}],"é":0}',
    );
  });

  it('refuses what is not JSON', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson([Infinity])).toThrow();
  });
});

describe('checkAttestation with registry attestations', () => {
  const weth = fixture('registry/weth/calldata-weth.json');
  const attestation = fixture(`registry/weth/sigs/${sigName('calldata-weth')}`);

  it('hashes a descriptor without includes to its attested value', () => {
    expect(descriptorHash(weth)).toBe(attestation.sig.message.data);
  });

  it('accepts the auditor and recomputes the uid the file names', () => {
    expect(checkAttestation(attestation, descriptorHash(weth))).toEqual({
      attester: CYFRIN,
      uid: attestation.sig.uid,
    });
  });

  it('refuses it for another descriptor', () => {
    const changed = { ...weth, metadata: { owner: 'Someone else' } };
    expect(checkAttestation(attestation, descriptorHash(changed))).toBeNull();
  });

  it('refuses a message changed after signing', () => {
    const tampered = structuredClone(attestation);
    tampered.sig.message.time = '1';
    expect(checkAttestation(tampered, descriptorHash(weth))).toBeNull();
  });

  it.each([
    ['an unknown recovery id', { v: 30 }],
    ['an r of zero', { r: `0x${'00'.repeat(32)}` }],
    ['a v that is text', { v: '28' }],
    ['a v that is not a whole number', { v: 27.5 }],
  ])('refuses a signature with %s', (_, change) => {
    const tampered = structuredClone(attestation);
    tampered.sig.signature = { ...tampered.sig.signature, ...change };
    expect(checkAttestation(tampered, descriptorHash(weth))).toBeNull();
  });

  describe('with attestations already verified', () => {
    const unsigned = structuredClone(attestation);
    unsigned.sig.signature.r = `0x${'00'.repeat(32)}`;
    const uid = attestation.sig.uid;

    it('trusts a verified uid without recovering the signature', () => {
      const verified = new Map([[uid, CYFRIN]]);
      expect(
        checkAttestation(unsigned, descriptorHash(weth), Date.now(), verified),
      ).toEqual({ attester: CYFRIN, uid });
    });

    it('still needs the descriptor to match', () => {
      const changed = { ...weth, metadata: { owner: 'Someone else' } };
      const verified = new Map([[uid, CYFRIN]]);
      expect(
        checkAttestation(
          attestation,
          descriptorHash(changed),
          Date.now(),
          verified,
        ),
      ).toBeNull();
    });

    it('recovers the signature when the uid names an attester the app does not trust', () => {
      const stranger = '0x00000000000000000000000000000000000000aa';
      const verified = new Map([[uid, stranger]]);
      expect(
        checkAttestation(unsigned, descriptorHash(weth), Date.now(), verified),
      ).toBeNull();
      expect(
        checkAttestation(
          attestation,
          descriptorHash(weth),
          Date.now(),
          verified,
        )?.attester,
      ).toBe(CYFRIN);
    });

    it('ships only trusted attesters', () => {
      expect(BUNDLED_ATTESTATIONS.size).toBeGreaterThan(0);
      for (const [key, attester] of BUNDLED_ATTESTATIONS) {
        expect(key).toMatch(/^0x[0-9a-f]{64}$/);
        expect(TRUSTED_ATTESTERS.has(attester)).toBe(true);
      }
    });
  });

  it.each([null, 'text', {}, { sig: {} }, { sig: { message: {} } }])(
    'refuses %p',
    raw => {
      expect(checkAttestation(raw, descriptorHash(weth))).toBeNull();
    },
  );
});

describe('checkAttestation with a key the test trusts', () => {
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
  const stranger = privateKeyToAccount(`0x${'22'.repeat(32)}`);
  const hash = `0x${'ab'.repeat(32)}` as Hex;
  const trusted = TRUSTED_ATTESTERS as Map<string, string>;

  beforeAll(() => trusted.set(account.address, 'Test'));
  afterAll(() => trusted.delete(account.address));

  async function attest(
    signer = account,
    overrides: Record<string, unknown> = {},
  ) {
    const message = {
      version: 2,
      schema: SCHEMA_UID as Hex,
      recipient: '0x0000000000000000000000000000000000000000' as Hex,
      time: 1700000000n,
      expirationTime: 0n,
      revocable: true,
      refUID: `0x${'00'.repeat(32)}` as Hex,
      data: hash,
      salt: `0x${'5a'.repeat(32)}` as Hex,
      ...overrides,
    };
    const signature = await signer.signTypedData({
      domain: {
        name: 'EAS Attestation',
        version: '0.26',
        chainId: 1,
        verifyingContract: EAS_CONTRACT,
      },
      types: {
        Attest: [
          { name: 'version', type: 'uint16' },
          { name: 'schema', type: 'bytes32' },
          { name: 'recipient', type: 'address' },
          { name: 'time', type: 'uint64' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'revocable', type: 'bool' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'data', type: 'bytes' },
          { name: 'salt', type: 'bytes32' },
        ],
      },
      primaryType: 'Attest',
      message: message as any,
    });
    const { r, s, v } = parseSignature(signature);
    return {
      sig: {
        message: {
          ...message,
          time: String(message.time),
          expirationTime: String(message.expirationTime),
        },
        signature: { r, s, v: Number(v) },
      },
    };
  }

  it('accepts a trusted signer', async () => {
    expect(checkAttestation(await attest(), hash)?.attester).toBe(
      account.address,
    );
  });

  it('refuses a signer the app does not trust', async () => {
    expect(checkAttestation(await attest(stranger), hash)).toBeNull();
  });

  it('refuses another schema', async () => {
    const other = await attest(account, { schema: `0x${'cd'.repeat(32)}` });
    expect(checkAttestation(other, hash)).toBeNull();
  });

  it('refuses an expired attestation and accepts it before it expires', async () => {
    const expiring = await attest(account, { expirationTime: 1800000000n });
    expect(checkAttestation(expiring, hash, 1800000000 * 1000)).toBeNull();
    expect(checkAttestation(expiring, hash, 1799999999 * 1000)).not.toBeNull();
  });
});

describe('processRegistryZip with attestations', () => {
  it('marks every attested descriptor, includes or not, calldata and EIP-712', () => {
    const index = processRegistryZip(zip(registryFiles()));
    expect(wethFormat(index)?.reviewedBy).toEqual([CYFRIN]);
    expect(kilnFormat(index)?.reviewedBy).toEqual([CYFRIN]);
    expect(
      indexedFormat(index, 'eip712', 1, USDC, TRANSFER_AUTHORIZATION)
        ?.reviewedBy,
    ).toEqual([CYFRIN]);
  });

  it('counts an attestation of an older version of the file as none', () => {
    const index = processRegistryZip(zip(registryFiles()));
    const byKey = index.contracts[WCT];
    const [key] = Object.keys(byKey);
    expect(indexedFormat(index, 'contracts', 1, WCT, key)).not.toBeNull();
    expect(
      indexedFormat(index, 'contracts', 1, WCT, key)?.reviewedBy,
    ).toBeUndefined();
  });

  it('drops the review when the descriptor changes', () => {
    const files = registryFiles();
    files['registry/weth/calldata-weth.json'].display.formats[
      'deposit()'
    ].intent = 'Something else';
    expect(
      wethFormat(processRegistryZip(zip(files)))?.reviewedBy,
    ).toBeUndefined();
  });

  it('drops the review when a file it includes changes', () => {
    const files = registryFiles();
    files['registry/kiln/common-KilnVaults.json'].metadata.owner = 'Someone';
    expect(
      kilnFormat(processRegistryZip(zip(files)))?.reviewedBy,
    ).toBeUndefined();
  });

  it('shows a descriptor it cannot hash, unreviewed', () => {
    const files = registryFiles();
    // 1e400 parses to Infinity, which RFC 8785 cannot write.
    const json = JSON.stringify(files['registry/weth/calldata-weth.json']);
    files['registry/weth/calldata-weth.json'] = `{"x":1e400,${json.slice(1)}`;
    const format = wethFormat(processRegistryZip(zip(files)));
    expect(format?.intent).toBeDefined();
    expect(format?.reviewedBy).toBeUndefined();
  });

  it('drops a revoked attestation, whatever uid the file claims', () => {
    const files = registryFiles();
    const sigPath = `registry/weth/sigs/${sigName('calldata-weth')}`;
    const realUid = files[sigPath].sig.uid;
    files[sigPath].sig.uid = `0x${'00'.repeat(32)}`;
    const revoked = new Set([
      revocationKey({ attester: CYFRIN, uid: realUid }),
    ]);
    expect(
      wethFormat(processRegistryZip(zip(files), { revoked }))?.reviewedBy,
    ).toBeUndefined();
    expect(
      kilnFormat(processRegistryZip(zip(files), { revoked }))?.reviewedBy,
    ).toEqual([CYFRIN]);
  });

  it('lists the accepted attestations for the revocation lookup', () => {
    const accepted = acceptedAttestations(zip(registryFiles()));
    expect(accepted).toHaveLength(3);
    expect(accepted).toContainEqual({
      attester: CYFRIN,
      uid: fixture(`registry/weth/sigs/${sigName('calldata-weth')}`).sig.uid,
    });
  });

  it('ignores an attestation file named after an attester the app does not trust', () => {
    const files = registryFiles();
    const stranger = '0x00000000000000000000000000000000000000aa';
    const sigPath = `registry/weth/sigs/${sigName('calldata-weth')}`;
    files[`registry/weth/sigs/${sigName('calldata-weth', stranger)}`] =
      files[sigPath];
    delete files[sigPath];
    expect(
      wethFormat(processRegistryZip(zip(files)))?.reviewedBy,
    ).toBeUndefined();
  });

  it('keeps a reviewed entry when an unreviewed file claims its deployment', () => {
    const files = registryFiles();
    const copy = structuredClone(files['registry/weth/calldata-weth.json']);
    copy.display.formats['deposit()'].intent = 'Drain';
    const at = 'registry/other/calldata-weth.json';
    for (const ordered of [
      { [at]: copy, ...files },
      { ...files, [at]: copy },
    ]) {
      const index = processRegistryZip(zip(ordered));
      expect(wethFormat(index)?.intent).not.toBe('Drain');
      expect(wethFormat(index)?.reviewedBy).toEqual([CYFRIN]);
    }
  });

  it('keeps a reviewed format apart from the same format nobody reviewed', () => {
    const files = registryFiles();
    const copy = structuredClone(files['registry/weth/calldata-weth.json']);
    copy.context.contract.deployments = [
      { chainId: 1, address: '0x00000000000000000000000000000000000000bb' },
    ];
    const index = processRegistryZip(
      zip({ ...files, 'registry/other/calldata-weth.json': copy }),
    );
    expect(wethFormat(index)?.reviewedBy).toEqual([CYFRIN]);
    expect(
      indexedFormat(
        index,
        'contracts',
        1,
        '0x00000000000000000000000000000000000000bb',
        DEPOSIT,
      )?.reviewedBy,
    ).toBeUndefined();
  });
});
