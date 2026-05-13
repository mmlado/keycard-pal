import { SCALAR_BYTES, derIntTo32 } from '../src/utils/keycardTlv';

describe('derIntTo32', () => {
  it('returns a 32-byte value unchanged', () => {
    const input = new Uint8Array(SCALAR_BYTES).fill(0xab);
    expect(derIntTo32(input)).toBe(input);
  });

  it('strips a leading 0x00 padding byte', () => {
    const value = new Uint8Array(SCALAR_BYTES).fill(0x01);
    const input = new Uint8Array([0x00, ...value]);
    const result = derIntTo32(input);
    expect(result).toEqual(value);
    expect(result.length).toBe(SCALAR_BYTES);
  });

  it('left-pads a short integer to 32 bytes', () => {
    const input = new Uint8Array([0x01]);
    const result = derIntTo32(input);
    expect(result.length).toBe(SCALAR_BYTES);
    expect(result[SCALAR_BYTES - 1]).toBe(0x01);
    expect(result.slice(0, SCALAR_BYTES - 1).every(b => b === 0)).toBe(true);
  });

  it('throws RangeError for empty input after stripping', () => {
    expect(() => derIntTo32(new Uint8Array([0x00]))).toThrow(RangeError);
  });

  it('throws RangeError for oversized input', () => {
    expect(() =>
      derIntTo32(new Uint8Array(SCALAR_BYTES + 1).fill(0x01)),
    ).toThrow(RangeError);
  });
});
