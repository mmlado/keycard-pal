import { readFileSync } from 'fs';
import { join } from 'path';

import jsQR from 'jsqr';
import sharp from 'sharp';

import {
  decodeCompactSeedQr,
  decodeSeedQr,
  isCompactSeedQrBytes,
  isSeedQrPayload,
} from '../src/utils/seedQr';

// The reference SeedQRs published alongside the format specification, decoded here as
// images rather than as payloads typed into a fixture. A charset or truncation bug in
// the decode path is invisible to a payload-level test and shows up here.
//
// This exercises everything above the native bridge. It does not exercise ZXing on
// Android or AVFoundation on iOS, which is a device check.
const FIXTURES = join(__dirname, 'fixtures', 'seedqr');

const WORDS: Record<number, string> = {
  1: 'attack pizza motion avocado network gather crop fresh patrol unusual wild holiday candy pony ranch winter theme error hybrid van cereal salon goddess expire',
  2: 'atom solve joy ugly ankle message setup typical bean era cactus various odor refuse element afraid meadow quick medal plate wisdom swap noble shallow',
  3: 'sound federal bonus bleak light raise false engage round stock update render quote truck quality fringe palace foot recipe labor glow tortoise potato still',
  4: 'forum undo fragile fade shy sign arrest garment culture tube off merit',
  5: 'good battle boil exact add seed angle hurry success glad carbon whisper',
  6: 'approve fruit lens brass ring actual stool coin doll boss strong rate',
  7: 'dignity utility vacant shiver thought canoe feel multiply item youth actor coyote',
  8: 'corn voice scrap arrow original diamond trial property benefit choose junk lock',
  9: 'vocal tray giggle tool duck letter category pattern train magnet excite swamp',
};

const STANDARD = [1, 2, 3, 4, 5, 6].map(n => ({
  n,
  file: `vector${n}_standard_${n <= 3 ? 24 : 12}word.png`,
}));

const COMPACT = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({
  n,
  file: `vector${n}_compact_${n <= 3 ? 24 : 12}word.png`,
}));

async function scan(file: string) {
  const { data, info } = await sharp(readFileSync(join(FIXTURES, file)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!result) throw new Error(`no QR decoded in ${file}`);
  return {
    text: result.data,
    bytes: Uint8Array.from(result.binaryData),
    modes: result.chunks.map(c => c.type),
  };
}

describe('Standard SeedQR reference images', () => {
  it.each(STANDARD)(
    'vector $n decodes to its published phrase',
    async ({ n, file }) => {
      const { text, modes } = await scan(file);
      expect(modes).toContain('numeric');
      expect(isSeedQrPayload(text)).toBe(true);
      expect(decodeSeedQr(text)).toEqual({
        kind: 'success',
        words: WORDS[n].split(' '),
      });
    },
  );
});

describe('CompactSeedQR reference images', () => {
  it.each(COMPACT)(
    'vector $n decodes to its published phrase',
    async ({ n, file }) => {
      const { bytes, modes } = await scan(file);
      expect(modes).toEqual(['byte']);
      expect(isCompactSeedQrBytes(bytes)).toBe(true);
      expect(decodeCompactSeedQr(bytes)).toEqual({
        kind: 'success',
        words: WORDS[n].split(' '),
      });
    },
  );

  // Vectors 1, 2 and 6 carry 0x00; 7, 8 and 9 carry \n, \r and \r\n. These are the
  // payloads that a reader treating the data as text truncates or mangles.
  it.each([1, 2, 6, 7, 8, 9])(
    'vector %i survives its control bytes, which the text path does not',
    async n => {
      const file = COMPACT.find(c => c.n === n)!.file;
      const { text, bytes } = await scan(file);
      expect(bytes.length).toBe(n <= 3 ? 32 : 16);
      expect(Buffer.from(text, 'utf8')).not.toEqual(Buffer.from(bytes));
      expect(decodeCompactSeedQr(bytes).kind).toBe('success');
    },
  );

  it('both encodings of a vector give the same phrase', async () => {
    for (const { n, file } of STANDARD) {
      const standard = decodeSeedQr((await scan(file)).text);
      const compactFile = COMPACT.find(c => c.n === n)!.file;
      const compact = decodeCompactSeedQr((await scan(compactFile)).bytes);
      expect(compact).toEqual(standard);
    }
  });
});
