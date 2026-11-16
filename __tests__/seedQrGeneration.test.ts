/* eslint-disable no-bitwise */
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import jsQR from 'jsqr';

import {
  decodeCompactSeedQr,
  decodeSeedQr,
  SEED_QR_ERROR_CORRECTION,
  seedQrSegments,
  type SeedQrFormat,
} from '../src/utils/seedQr';

// What react-native-qrcode-svg draws from its value.
const genMatrix: (value: unknown, ecl: string) => number[][] =
  require('react-native-qrcode-svg/src/genMatrix').default;

const SIZES: Record<SeedQrFormat, Record<number, number>> = {
  standard: { 12: 25, 24: 29 },
  compact: { 12: 21, 24: 25 },
};

const MODES: Record<SeedQrFormat, string> = {
  standard: 'numeric',
  compact: 'byte',
};

// The bytes a reader that treats data as text mangles: 0x00, line ends, high and UTF-8 lead bytes.
function edgeEntropies(length: number): [string, Uint8Array][] {
  const fill = (v: number) => new Uint8Array(length).fill(v);
  const seq = (f: (i: number) => number) =>
    Uint8Array.from({ length }, (_, i) => f(i));
  return [
    ['all 0x00', fill(0x00)],
    ['all 0xff', fill(0xff)],
    ['all 0x0a', fill(0x0a)],
    ['all 0x0d', fill(0x0d)],
    ['0x0d 0x0a repeated', seq(i => (i % 2 ? 0x0a : 0x0d))],
    ['ascending from 0x00', seq(i => i)],
    ['descending from 0xff', seq(i => 0xff - i)],
    ['0x00 and 0xff alternating', seq(i => (i % 2 ? 0xff : 0x00))],
    ['all 0x80', fill(0x80)],
    ['all 0x7f', fill(0x7f)],
    ['all 0x20', fill(0x20)],
    ['UTF-8 lead bytes', seq(i => 0xc0 + (i % 0x40))],
  ];
}

// xorshift32, so every run checks the same sample.
function sample(length: number, count: number, seed: number) {
  let state = seed;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return Array.from({ length: count }, (_, i): [string, Uint8Array] => [
    `sample ${i}`,
    Uint8Array.from({ length }, () => next() & 0xff),
  ]);
}

function read(matrix: number[][]) {
  const scale = 4;
  const quiet = 4;
  const width = (matrix.length + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) {
        return;
      }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const pixel =
            ((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx;
          pixels.fill(0, pixel * 4, pixel * 4 + 3);
        }
      }
    }),
  );
  const code = jsQR(pixels, width, width);
  if (!code) {
    throw new Error('the drawn code does not decode');
  }
  return {
    modes: code.chunks.map(c => c.type),
    text: code.data,
    bytes: Uint8Array.from(code.binaryData),
  };
}

const CASES = [12, 24].flatMap(count => {
  const length = (count / 3) * 4;
  return [...edgeEntropies(length), ...sample(length, 25, count)].map(
    ([name, entropy]) => ({ name: `${count} words, ${name}`, count, entropy }),
  );
});

describe.each(['standard', 'compact'] as const)(
  '%s SeedQR generation',
  format => {
    it.each(CASES)('$name reads back as its phrase', ({ count, entropy }) => {
      const words = entropyToMnemonic(entropy, wordlist).split(' ');
      const matrix = genMatrix(
        seedQrSegments(words, format),
        SEED_QR_ERROR_CORRECTION,
      );
      expect(matrix).toHaveLength(SIZES[format][count]);

      const code = read(matrix);
      expect(code.modes).toEqual([MODES[format]]);
      expect(
        format === 'standard'
          ? decodeSeedQr(code.text)
          : decodeCompactSeedQr(code.bytes),
      ).toEqual({ kind: 'success', words });
    });
  },
);
