import {
  decodeCompactSeedQr,
  decodeSeedQr,
  isCompactSeedQrBytes,
  isSeedQrPayload,
} from '../src/utils/seedQr';

// The nine published SeedQR test vectors: the Standard digit stream, the
// CompactSeedQR entropy and the phrase both decode to. Vectors 1, 2 and 6 carry a
// 0x00 byte and 7 to 9 carry \n, \r and \r\n, which is what catches a reader that
// truncates on control bytes.
const VECTORS: { n: number; digits: string; hex: string; words: string }[] = [
  {
    n: 1,
    digits:
      '011513251154012711900771041507421289190620080870026613431420201617920614089619290300152408010643',
    hex: '0e74b64107f94cc0ccfae6a13dcbec3662154fec67e0e00999c07892597d190a',
    words:
      'attack pizza motion avocado network gather crop fresh patrol unusual wild holiday candy pony ranch winter theme error hybrid van cereal salon goddess expire',
  },
  {
    n: 2,
    digits:
      '011416550964188800731119157218870156061002561932122514430573003611011405110613292018175411971576',
    hex: '0e59dde276009317f1275f1389888078c99368d1e82489b5f629531fc5b6a56e',
    words:
      'atom solve joy ugly ankle message setup typical bean era cactus various odor refuse element afraid meadow quick medal plate wisdom swap noble shallow',
  },
  {
    n: 3,
    digits:
      '166206750203018810361417065805941507171219081456140818651401074412730727143709940798183613501710',
    hex: 'cfca8c658bc81962549252bc7ac3ba5b0b01d26bcae89f2b5ecebe263dcb2a36',
    words:
      'sound federal bonus bleak light raise false engage round stock update render quote truck quality fringe palace foot recipe labor glow tortoise potato still',
  },
  {
    n: 4,
    digits: '073318950739065415961602009907670428187212261116',
    hex: '5bbd9d71a8ec7990831aff359d426545',
    words:
      'forum undo fragile fade shy sign arrest garment culture tube off merit',
  },
  {
    n: 5,
    digits: '080301540200062600251559007008931730078802752004',
    hex: '6462686427203385c2337dd84c5089fd',
    words:
      'good battle boil exact add seed angle hurry success glad carbon whisper',
  },
  {
    n: 6,
    digits: '008607501025021714880023171503630517020917211425',
    hex: '0acbba008d9ba005f5996b40a3475cd9',
    words:
      'approve fruit lens brass ring actual stool coin doll boss strong rate',
  },
  {
    n: 7,
    digits: '049619221923158517990268067811630950204300210397',
    hex: '3e1e0bc1e31e0e4315348b76dfec0a98',
    words:
      'dignity utility vacant shiver thought canoe feel multiply item youth actor coyote',
  },
  {
    n: 8,
    digits: '038719631547010112530489185713790169032209701051',
    hex: '307eaf058659ca7a7a0d63152509e541',
    words:
      'corn voice scrap arrow original diamond trial property benefit choose junk lock',
  },
  {
    n: 9,
    digits: '196218530783182905421028028912901848107106301753',
    hex: 'f55cf587f2543d01090d0ae710bd3b6d',
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

const bytesOf = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));

describe('decodeCompactSeedQr', () => {
  it.each(VECTORS)('decodes published vector $n', ({ hex, words }) => {
    expect(decodeCompactSeedQr(bytesOf(hex))).toEqual({
      kind: 'success',
      words: words.split(' '),
    });
  });

  it('agrees with the Standard stream for every vector', () => {
    for (const { digits, hex } of VECTORS) {
      expect(decodeCompactSeedQr(bytesOf(hex))).toEqual(decodeSeedQr(digits));
    }
  });

  it('derives the checksum rather than carrying it, so any 16 bytes decode', () => {
    const result = decodeCompactSeedQr(new Uint8Array(16));
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.words[11]).toBe('about');
    }
  });

  it.each([0, 15, 17, 20, 24, 28, 31, 33])('rejects %i bytes', length => {
    expect(decodeCompactSeedQr(new Uint8Array(length))).toEqual({
      kind: 'error',
      message: `Invalid CompactSeedQR: expected 16 or 32 bytes, got ${length}`,
    });
  });
});

describe('isCompactSeedQrBytes', () => {
  it.each([16, 32])('accepts %i bytes', length => {
    expect(isCompactSeedQrBytes(new Uint8Array(length))).toBe(true);
  });

  it.each([0, 15, 20, 24, 28, 48, 96])('rejects %i bytes', length => {
    expect(isCompactSeedQrBytes(new Uint8Array(length))).toBe(false);
  });
});
