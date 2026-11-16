import { readTlv } from '../src/utils/berTlv';
import { fromHex, toHex } from '../src/utils/hex';

describe('readTlv', () => {
  it.each([
    ['a one-byte tag', 'c50380ab00', 0xc5, '80ab00', 5],
    ['a two-byte tag', '9f70010f', 0x9f70, '0f', 4],
    [
      'the 81 length form',
      `e08180${'00'.repeat(0x80)}`,
      0xe0,
      '00'.repeat(0x80),
      0x83,
    ],
    [
      'the 82 length form',
      `e0820100${'00'.repeat(0x100)}`,
      0xe0,
      '00'.repeat(0x100),
      0x104,
    ],
    ['an empty value', '4f00', 0x4f, '', 2],
  ])('reads %s', (_, hex, tag, value, end) => {
    const tlv = readTlv(fromHex(hex), 0)!;
    expect(tlv.tag).toBe(tag);
    expect(toHex(tlv.value)).toBe(value);
    expect(tlv.end).toBe(end);
  });

  it('starts at the offset it is given', () => {
    const tlv = readTlv(fromHex('00004f02a000'), 2)!;
    expect(tlv.tag).toBe(0x4f);
    expect(toHex(tlv.value)).toBe('a000');
  });

  it.each([
    ['nothing', ''],
    ['a tag alone', 'c5'],
    ['a value past the end', 'c503ab'],
    ['a two-byte tag cut short', '9f'],
    ['a three-byte tag', '9f81010100'],
    ['an indefinite length', 'e08000'],
    ['a length form it does not take', 'e083000001'],
    ['an 81 length cut short', 'e081'],
  ])('reads nothing from %s', (_, hex) => {
    expect(readTlv(fromHex(hex), 0)).toBeNull();
  });
});
