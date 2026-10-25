import {
  ensureHexPrefix,
  fromHex,
  isWholeBytes,
  toHex,
} from '../src/utils/hex';

describe('ensureHexPrefix', () => {
  it('adds 0x prefix when missing', () => {
    expect(ensureHexPrefix('deadbeef')).toBe('0xdeadbeef');
  });

  it('keeps existing 0x prefix', () => {
    expect(ensureHexPrefix('0xdeadbeef')).toBe('0xdeadbeef');
  });
});

describe('toHex', () => {
  it('converts Uint8Array to lowercase hex string', () => {
    expect(toHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });

  it('pads single-byte values', () => {
    expect(toHex(new Uint8Array([0x01, 0x0a, 0xff]))).toBe('010aff');
  });

  it('handles empty array', () => {
    expect(toHex(new Uint8Array([]))).toBe('');
  });
});

describe('fromHex', () => {
  it('reads an unprefixed hex string', () => {
    expect(fromHex('00ff10')).toEqual(new Uint8Array([0x00, 0xff, 0x10]));
  });

  it('is the inverse of toHex', () => {
    const bytes = new Uint8Array([0x02, 0x9a, 0xb9, 0x00, 0x7f]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('reads an empty string as no bytes', () => {
    expect(fromHex('')).toEqual(new Uint8Array(0));
  });
});

describe('isWholeBytes', () => {
  it.each(['', '0x', 'a9059cbb', '0xa9059cbb', '0XA9059CBB', '0xAbCd'])(
    'takes %p',
    hex => expect(isWholeBytes(hex)).toBe(true),
  );

  it.each(['0xabc', 'abc', '0xzz', '0x0x12', ' 0x12'])('refuses %p', hex =>
    expect(isWholeBytes(hex)).toBe(false),
  );
});
