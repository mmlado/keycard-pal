import { decodeSeedQr, isSeedQrPayload } from '../src/utils/seedQr';

// The nine published SeedQR test vectors. Each is a Standard SeedQR digit stream and
// the phrase it decodes to. Vectors 7 to 9 exist upstream to catch readers that
// truncate on control bytes, which only bites the CompactSeedQR byte-mode payload.
const VECTORS: { n: number; digits: string; words: string }[] = [
  {
    n: 1,
    digits:
      '011513251154012711900771041507421289190620080870026613431420201617920614089619290300152408010643',
    words:
      'attack pizza motion avocado network gather crop fresh patrol unusual wild holiday candy pony ranch winter theme error hybrid van cereal salon goddess expire',
  },
  {
    n: 2,
    digits:
      '011416550964188800731119157218870156061002561932122514430573003611011405110613292018175411971576',
    words:
      'atom solve joy ugly ankle message setup typical bean era cactus various odor refuse element afraid meadow quick medal plate wisdom swap noble shallow',
  },
  {
    n: 3,
    digits:
      '166206750203018810361417065805941507171219081456140818651401074412730727143709940798183613501710',
    words:
      'sound federal bonus bleak light raise false engage round stock update render quote truck quality fringe palace foot recipe labor glow tortoise potato still',
  },
  {
    n: 4,
    digits: '073318950739065415961602009907670428187212261116',
    words:
      'forum undo fragile fade shy sign arrest garment culture tube off merit',
  },
  {
    n: 5,
    digits: '080301540200062600251559007008931730078802752004',
    words:
      'good battle boil exact add seed angle hurry success glad carbon whisper',
  },
  {
    n: 6,
    digits: '008607501025021714880023171503630517020917211425',
    words:
      'approve fruit lens brass ring actual stool coin doll boss strong rate',
  },
  {
    n: 7,
    digits: '049619221923158517990268067811630950204300210397',
    words:
      'dignity utility vacant shiver thought canoe feel multiply item youth actor coyote',
  },
  {
    n: 8,
    digits: '038719631547010112530489185713790169032209701051',
    words:
      'corn voice scrap arrow original diamond trial property benefit choose junk lock',
  },
  {
    n: 9,
    digits: '196218530783182905421028028912901848107106301753',
    words:
      'vocal tray giggle tool duck letter category pattern train magnet excite swamp',
  },
];

const VECTOR_4 = VECTORS[3].digits;

describe('decodeSeedQr', () => {
  it.each(VECTORS)('decodes published vector $n', ({ digits, words }) => {
    const result = decodeSeedQr(digits);
    expect(result).toEqual({ kind: 'success', words: words.split(' ') });
  });

  it.each(VECTORS)(
    'vector $n yields one word per four digits',
    ({ digits }) => {
      const result = decodeSeedQr(digits);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.words).toHaveLength(digits.length / 4);
      }
    },
  );

  it('ignores surrounding whitespace', () => {
    expect(decodeSeedQr(`  ${VECTOR_4}\n`)).toEqual(decodeSeedQr(VECTOR_4));
  });

  it('rejects a word index of 2048 or above', () => {
    const result = decodeSeedQr(`2048${VECTOR_4.slice(4)}`);
    expect(result).toEqual({
      kind: 'error',
      message: 'Invalid SeedQR: word index 2048 is out of range',
    });
  });

  it('rejects a digit change that breaks the checksum', () => {
    // 0733 "forum" becomes 0734 "forward"; every index stays in range.
    const result = decodeSeedQr(`0734${VECTOR_4.slice(4)}`);
    expect(result).toEqual({
      kind: 'error',
      message: 'Decoded recovery phrase failed its checksum',
    });
  });

  it('rejects a non-numeric payload', () => {
    const result = decodeSeedQr('not a seedqr');
    expect(result).toEqual({
      kind: 'error',
      message: 'SeedQR payload must be digits only',
    });
  });

  it.each([60, 72, 84])(
    'rejects %i digits, because only 12 and 24 words are defined',
    length => {
      const result = decodeSeedQr('0733'.repeat(length / 4));
      expect(result).toEqual({
        kind: 'error',
        message: `Invalid SeedQR: expected 48 or 96 digits, got ${length}`,
      });
    },
  );

  it('rejects hex entropy, which is no longer an accepted format', () => {
    const result = decodeSeedQr('5bbd9d71a8ec7990831aff359d426545');
    expect(result).toEqual({
      kind: 'error',
      message: 'SeedQR payload must be digits only',
    });
  });

  it('rejects all-numeric hex entropy on length', () => {
    // 32 digits passes the numeric gate, so the length gate is what refuses it.
    const result = decodeSeedQr('0'.repeat(32));
    expect(result).toEqual({
      kind: 'error',
      message: 'Invalid SeedQR: expected 48 or 96 digits, got 32',
    });
  });
});

describe('isSeedQrPayload', () => {
  it.each(VECTORS)('accepts published vector $n', ({ digits }) => {
    expect(isSeedQrPayload(digits)).toBe(true);
  });

  it('accepts a payload with surrounding whitespace', () => {
    expect(isSeedQrPayload(`  ${VECTOR_4} `)).toBe(true);
  });

  it('rejects a non-numeric payload', () => {
    expect(isSeedQrPayload('not a seedqr')).toBe(false);
  });

  it('rejects hex entropy', () => {
    expect(isSeedQrPayload('5bbd9d71a8ec7990831aff359d426545')).toBe(false);
  });

  it.each([44, 47, 49, 60, 95, 97])('rejects %i digits', length => {
    expect(isSeedQrPayload('7'.repeat(length))).toBe(false);
  });
});
