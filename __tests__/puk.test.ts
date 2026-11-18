import { PUK_LENGTH } from '../src/constants/keycard';

import {
  drawPuk,
  platformRandomBytes,
  PUK_DRAW_FAILED,
  PUK_DRAW_LENGTH,
  PUK_MAX_DRAWS,
} from '../src/utils/puk';

function constantSource(byte: number) {
  return jest.fn((length: number) => new Uint8Array(length).fill(byte));
}

function sequenceSource(chunks: number[][]) {
  let next = 0;
  return jest.fn(() => new Uint8Array(chunks[next++] ?? []));
}

describe('drawPuk', () => {
  // Uniform bytes give uniform digits only if every digit has as many bytes behind it.
  it('maps exactly 25 of the 256 byte values onto each digit, at every position', async () => {
    const counts = Array(10).fill(0);
    let rejected = 0;
    for (let byte = 0; byte < 256; byte++) {
      const puk = await drawPuk(constantSource(byte)).catch(() => null);
      if (puk === null) {
        rejected++;
      } else {
        expect(new Set(puk).size).toBe(1);
        expect(puk).toHaveLength(PUK_LENGTH);
        counts[Number(puk[0])]++;
      }
    }
    expect(counts).toEqual(Array(10).fill(25));
    expect(rejected).toBe(6);
  });

  it.each([250, 251, 252, 253, 254, 255])(
    'never turns byte %i into a digit',
    async byte => {
      await expect(drawPuk(constantSource(byte))).rejects.toThrow(
        PUK_DRAW_FAILED,
      );
    },
  );

  it('skips a rejected byte without shifting the digits after it', async () => {
    const source = sequenceSource([
      [250, 3, 255, 14, 25, 36, 47, 58, 69, 70, 81, 92, 103, 0, 0, 0],
    ]);
    expect(await drawPuk(source)).toBe('345678901230');
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('asks for more bytes until the PUK is full', async () => {
    const source = sequenceSource([
      [1, 2, 3, 4, 255, 255],
      [5, 6, 7],
      [8, 9, 0, 1, 2],
    ]);
    expect(await drawPuk(source)).toBe('123456789012');
    expect(source).toHaveBeenCalledTimes(3);
  });

  it('asks for a bounded length each time', async () => {
    const source = constantSource(7);
    await drawPuk(source);
    expect(source).toHaveBeenCalledWith(PUK_DRAW_LENGTH);
  });

  it('gives up on a source that never yields enough', async () => {
    const source = constantSource(255);
    await expect(drawPuk(source)).rejects.toThrow(PUK_DRAW_FAILED);
    expect(source).toHaveBeenCalledTimes(PUK_MAX_DRAWS);
  });

  it('takes an asynchronous source', async () => {
    const source = jest.fn(async (length: number) =>
      new Uint8Array(length).fill(42),
    );
    expect(await drawPuk(source)).toBe('2'.repeat(PUK_LENGTH));
  });
});

describe('platformRandomBytes', () => {
  it('fills the requested length from the platform RNG', () => {
    const getRandomValues = jest.spyOn(crypto, 'getRandomValues');
    const bytes = platformRandomBytes(PUK_DRAW_LENGTH);
    expect(bytes).toHaveLength(PUK_DRAW_LENGTH);
    expect(getRandomValues).toHaveBeenCalledWith(bytes);
    getRandomValues.mockRestore();
  });
});
