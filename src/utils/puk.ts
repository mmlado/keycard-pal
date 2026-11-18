import { PUK_LENGTH } from '@/constants/keycard';

export type RandomBytes = (length: number) => Uint8Array | Promise<Uint8Array>;

// Bytes from 250 up would fold onto 0 to 5 and favour them.
const DIGIT_BYTE_LIMIT = 250;
// One draw nearly always fills the PUK, so a card answers a single GET CHALLENGE.
export const PUK_DRAW_LENGTH = 16;
// A source that keeps failing is broken; never loop on it forever.
export const PUK_MAX_DRAWS = 8;

export const PUK_DRAW_FAILED = 'Could not draw a PUK from the random source.';

export async function drawPuk(randomBytes: RandomBytes): Promise<string> {
  const digits: number[] = [];
  for (
    let draw = 0;
    draw < PUK_MAX_DRAWS && digits.length < PUK_LENGTH;
    draw++
  ) {
    for (const byte of await randomBytes(PUK_DRAW_LENGTH)) {
      if (byte < DIGIT_BYTE_LIMIT && digits.length < PUK_LENGTH) {
        digits.push(byte % 10);
      }
    }
  }
  if (digits.length < PUK_LENGTH) {
    throw new Error(PUK_DRAW_FAILED);
  }
  return digits.join('');
}

export function platformRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
