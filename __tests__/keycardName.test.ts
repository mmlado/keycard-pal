/* eslint-disable no-bitwise */

import {
  displayKeycardName,
  encodeKeycardName,
  formatFingerprint,
  mergeKeycardNameMetadata,
  parseKeycardName,
  validateKeycardName,
} from '../src/utils/keycardName';

describe('keycardName', () => {
  it('encodes and parses shell-compatible length-prefixed names', () => {
    const encoded = encodeKeycardName('Main card');
    expect(Array.from(encoded)).toEqual([
      0x20 | 9,
      0x4d,
      0x61,
      0x69,
      0x6e,
      0x20,
      0x63,
      0x61,
      0x72,
      0x64,
    ]);
    expect(parseKeycardName(encoded)).toBe('Main card');
  });

  it('encodes an empty name as a clear operation', () => {
    const encoded = encodeKeycardName('');
    expect(Array.from(encoded)).toEqual([0x20]);
    expect(parseKeycardName(encoded)).toBe('');
  });

  it('parses missing metadata as an empty name', () => {
    expect(parseKeycardName()).toBe('');
    expect(parseKeycardName(null)).toBe('');
    expect(parseKeycardName(new Uint8Array())).toBe('');
  });

  it('ignores metadata that does not start with a name field', () => {
    expect(parseKeycardName(new Uint8Array([0x40, 0x01]))).toBe('');
  });

  it('throws on corrupt metadata where name length exceeds data', () => {
    const corrupt = new Uint8Array([0x20 | 10, 0x41]);
    expect(() => mergeKeycardNameMetadata('New', corrupt)).toThrow(
      'Corrupt card metadata',
    );
  });

  it('preserves existing metadata after the card name field', () => {
    const current = new Uint8Array([
      0x20 | 3,
      0x6f,
      0x6c,
      0x64,
      0x40,
      0x02,
      0xaa,
      0xbb,
    ]);
    expect(Array.from(mergeKeycardNameMetadata('New', current))).toEqual([
      0x20 | 3,
      0x4e,
      0x65,
      0x77,
      0x40,
      0x02,
      0xaa,
      0xbb,
    ]);
  });

  it('uses only the encoded name when there is no existing name metadata', () => {
    expect(Array.from(mergeKeycardNameMetadata('New'))).toEqual([
      0x20 | 3,
      0x4e,
      0x65,
      0x77,
    ]);
    expect(
      Array.from(mergeKeycardNameMetadata('New', new Uint8Array([0x40]))),
    ).toEqual([0x20 | 3, 0x4e, 0x65, 0x77]);
  });

  it('rejects names longer than the Keycard field limit', () => {
    expect(() => encodeKeycardName('x'.repeat(21))).toThrow(
      'Card name must be 20 bytes or fewer.',
    );
  });

  it('validateKeycardName passes for valid names', () => {
    expect(() => validateKeycardName('My card')).not.toThrow();
    expect(() => validateKeycardName('')).not.toThrow();
    expect(() => validateKeycardName('x'.repeat(20))).not.toThrow();
  });

  it('validateKeycardName rejects names over the byte limit', () => {
    expect(() => validateKeycardName('x'.repeat(21))).toThrow(
      'Card name must be 20 bytes or fewer.',
    );
  });

  it('displays a placeholder for blank card names', () => {
    expect(displayKeycardName('Main card')).toBe('Main card');
    expect(displayKeycardName('')).toBe('Unnamed card');
    expect(displayKeycardName(null)).toBe('Unnamed card');
  });

  it('formats a master fingerprint as 8 lowercase hex chars', () => {
    expect(formatFingerprint(0x1a2b3c4d)).toBe('1a2b3c4d');
    expect(formatFingerprint(0x000000ff)).toBe('000000ff');
    expect(formatFingerprint(0)).toBe('00000000');
    // Sign-bit-set values must stay unsigned (>>> 0).
    expect(formatFingerprint(0xfeed1234)).toBe('feed1234');
  });

  it('falls back to the fingerprint when the card name is blank', () => {
    expect(displayKeycardName('Main card', 0x1a2b3c4d)).toBe('Main card');
    expect(displayKeycardName('', 0x1a2b3c4d)).toBe('1a2b3c4d');
    expect(displayKeycardName(null, 0x1a2b3c4d)).toBe('1a2b3c4d');
    expect(displayKeycardName('', null)).toBe('Unnamed card');
  });
});
