import {
  computeCalldataDigest,
  computeEip712DigestFromJson,
  computeEip712DigestFromPrehashed,
  computeErc191Digest,
} from '../src/utils/erc8213';

const HEX_HASH = /^0x[0-9a-f]{64}$/;
const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('computeCalldataDigest', () => {
  it('returns null for empty string', () => {
    expect(computeCalldataDigest('')).toBeNull();
  });

  it('returns null for 0x prefix only', () => {
    expect(computeCalldataDigest('0x')).toBeNull();
  });

  it('returns a 32-byte hex hash for valid calldata', () => {
    const result = computeCalldataDigest('0xa9059cbb');
    expect(result).toMatch(HEX_HASH);
  });

  it('handles calldata without 0x prefix', () => {
    const withPrefix = computeCalldataDigest('0xa9059cbb');
    const withoutPrefix = computeCalldataDigest('a9059cbb');
    expect(withPrefix).toEqual(withoutPrefix);
  });

  it('different calldata produces different digests', () => {
    const a = computeCalldataDigest('0xaabbccdd');
    const b = computeCalldataDigest('0x11223344');
    expect(a).not.toEqual(b);
  });

  it('returns null for odd-length calldata', () => {
    expect(computeCalldataDigest('0xabc')).toBeNull();
  });
});

describe('computeEip712DigestFromJson', () => {
  const domain = {
    name: 'Test',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  };
  const types = {
    Mail: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
    ],
  };
  const message = {
    from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    to: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
  };

  it('returns a 32-byte hex hash for valid typed data', () => {
    const result = computeEip712DigestFromJson(domain, message, 'Mail', types);
    expect(result).toMatch(HEX_HASH);
  });

  it('is deterministic', () => {
    const a = computeEip712DigestFromJson(domain, message, 'Mail', types);
    const b = computeEip712DigestFromJson(domain, message, 'Mail', types);
    expect(a).toEqual(b);
  });

  it('returns null for invalid types that viem rejects', () => {
    const result = computeEip712DigestFromJson(domain, message, 'Mail', {
      Mail: [{ name: 'from', type: 'badtype!!!!' }],
    });
    expect(result).toBeNull();
  });
});

describe('computeEip712DigestFromPrehashed', () => {
  it('returns a 32-byte hex hash', () => {
    const result = computeEip712DigestFromPrehashed(ZERO_HASH, ZERO_HASH);
    expect(result).toMatch(HEX_HASH);
  });

  it('is deterministic', () => {
    const a = computeEip712DigestFromPrehashed(ZERO_HASH, ZERO_HASH);
    const b = computeEip712DigestFromPrehashed(ZERO_HASH, ZERO_HASH);
    expect(a).toEqual(b);
  });

  it('different inputs produce different digests', () => {
    const domainHash =
      '0x1111111111111111111111111111111111111111111111111111111111111111';
    const a = computeEip712DigestFromPrehashed(ZERO_HASH, ZERO_HASH);
    const b = computeEip712DigestFromPrehashed(domainHash, ZERO_HASH);
    expect(a).not.toEqual(b);
  });

  it('matches manual EIP-712 digest computation', () => {
    // keccak256("\x19\x01" || domainSep || msgHash) should match hashTypedData
    // from the JSON path for the same domain+message
    const { keccak256, concat } = require('viem');
    const expected = keccak256(
      concat([
        '0x1901' as `0x${string}`,
        ZERO_HASH as `0x${string}`,
        ZERO_HASH as `0x${string}`,
      ]),
    );
    expect(computeEip712DigestFromPrehashed(ZERO_HASH, ZERO_HASH)).toEqual(
      expected,
    );
  });
});

describe('computeErc191Digest', () => {
  it('matches the known personal_sign digest of "hello world"', () => {
    expect(computeErc191Digest(Buffer.from('hello world', 'utf8'))).toBe(
      '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68',
    );
  });

  it('hashes the bytes, not a decoded string', () => {
    const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0x80]);
    const { keccak256, concat, stringToBytes } = require('viem');
    const expected = keccak256(
      concat([stringToBytes('\x19Ethereum Signed Message:\n3'), invalidUtf8]),
    );
    expect(computeErc191Digest(invalidUtf8)).toBe(expected);
  });

  it('prefixes the byte length, not the character count', () => {
    const twoBytesOneChar = Buffer.from('é', 'utf8');
    const { keccak256, concat, stringToBytes } = require('viem');
    const expected = keccak256(
      concat([
        stringToBytes('\x19Ethereum Signed Message:\n2'),
        twoBytesOneChar,
      ]),
    );
    expect(computeErc191Digest(twoBytesOneChar)).toBe(expected);
  });

  it('handles the empty message', () => {
    expect(computeErc191Digest(new Uint8Array(0))).toMatch(HEX_HASH);
  });
});
