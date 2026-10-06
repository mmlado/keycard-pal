import { decodeUtf8Strict } from '../src/utils/utf8';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('decodeUtf8Strict', () => {
  it('decodes ASCII', () => {
    expect(decodeUtf8Strict(Buffer.from('hello world', 'utf8'))).toBe(
      'hello world',
    );
  });

  it('decodes multi-byte sequences', () => {
    const text = 'héllo € 🙂';
    expect(decodeUtf8Strict(Buffer.from(text, 'utf8'))).toBe(text);
  });

  it('decodes an empty message to the empty string', () => {
    expect(decodeUtf8Strict(bytes())).toBe('');
  });

  it('keeps a leading byte order mark', () => {
    expect(decodeUtf8Strict(bytes(0xef, 0xbb, 0xbf, 0x41))).toBe('﻿A');
  });

  it('keeps a literal U+FFFD', () => {
    expect(decodeUtf8Strict(bytes(0xef, 0xbf, 0xbd))).toBe('�');
  });

  it('returns null for a stray continuation byte', () => {
    expect(decodeUtf8Strict(bytes(0x41, 0x80))).toBeNull();
  });

  it('returns null for a byte that never occurs in UTF-8', () => {
    expect(decodeUtf8Strict(bytes(0xff))).toBeNull();
  });

  it('returns null for a truncated sequence', () => {
    expect(decodeUtf8Strict(bytes(0xe2, 0x82))).toBeNull();
  });

  it('returns null for an overlong encoding', () => {
    expect(decodeUtf8Strict(bytes(0xc0, 0x80))).toBeNull();
  });

  it('returns null for an encoded surrogate', () => {
    expect(decodeUtf8Strict(bytes(0xed, 0xa0, 0x80))).toBeNull();
  });
});
