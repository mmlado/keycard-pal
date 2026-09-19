import {
  appletVersion,
  ALL_GENERATIONS,
  cardGeneration,
  formatAppletVersion,
  generationLabel,
  GENERATIONS,
  isBelowMinimumVersion,
  isNewerGeneration,
  MIN_SUPPORTED_APPLET_VERSION,
  parseGenerations,
  parseGenerationsInUse,
  secureChannelVersion,
  serializeGenerations,
} from '../src/utils/cardGeneration';

import { blankV3Select, v3Select, v4Select } from './selectResponse.testUtils';

describe('formatAppletVersion', () => {
  it('renders major.minor', () => {
    expect(formatAppletVersion(0x0301)).toBe('3.1');
    expect(formatAppletVersion(0x0400)).toBe('4.0');
    expect(formatAppletVersion(0x030a)).toBe('3.10');
  });
});

describe('GENERATIONS', () => {
  it('names each generation after its minimum applet version', () => {
    for (const { generation, minAppletVersion } of GENERATIONS) {
      expect(generation).toBe(formatAppletVersion(minAppletVersion));
    }
  });

  it('is ordered oldest first', () => {
    const versions = GENERATIONS.map(entry => entry.minAppletVersion);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });

  it('puts the floor at 3.1', () => {
    expect(MIN_SUPPORTED_APPLET_VERSION).toBe(0x0301);
  });
});

describe('appletVersion', () => {
  it('reads the version a card reports', () => {
    expect(appletVersion(v3Select(0x0302))).toBe(0x0302);
    expect(appletVersion(v4Select(0x0400))).toBe(0x0400);
  });

  it('is null for an uninitialized 3.x card, which reports none', () => {
    expect(appletVersion(blankV3Select())).toBeNull();
  });
});

describe('cardGeneration', () => {
  it('refuses a 3.0 card', () => {
    expect(cardGeneration(v3Select(0x0300))).toBeNull();
  });

  it('puts 3.1 and 3.2 cards in the 3.1 generation', () => {
    expect(cardGeneration(v3Select(0x0301))).toBe('3.1');
    expect(cardGeneration(v3Select(0x0302))).toBe('3.1');
  });

  it('puts a 4.0 card in the 4.0 generation', () => {
    expect(cardGeneration(v4Select(0x0400))).toBe('4.0');
  });

  it('puts a blank 4.0 card in the 4.0 generation, since it still reports a version', () => {
    expect(cardGeneration(v4Select(0x0400, { status: 0x00 }))).toBe('4.0');
  });

  it('puts a newer applet in the newest known generation', () => {
    expect(cardGeneration(v4Select(0x0500))).toBe('4.0');
  });

  it('sends an uninitialized 3.x card down the 3.x path', () => {
    expect(cardGeneration(blankV3Select())).toBe('3.1');
  });
});

describe('isBelowMinimumVersion', () => {
  it('is true only for a reported version below the floor', () => {
    expect(isBelowMinimumVersion(v3Select(0x0300))).toBe(true);
    expect(isBelowMinimumVersion(v3Select(0x0301))).toBe(false);
    expect(isBelowMinimumVersion(v4Select(0x0400))).toBe(false);
  });

  it('does not refuse an uninitialized 3.x card', () => {
    expect(isBelowMinimumVersion(blankV3Select())).toBe(false);
  });
});

describe('generationLabel', () => {
  it('names a generation the way the user reads it', () => {
    expect(generationLabel('3.1')).toBe('3.x');
    expect(generationLabel('4.0')).toBe('4.x');
  });

  // The label is written by hand, so every generation has to have one.
  it('has a label for every generation', () => {
    for (const { label } of GENERATIONS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the name for a generation it does not know', () => {
    expect(generationLabel('9.9' as any)).toBe('9.9');
  });
});

describe('isNewerGeneration', () => {
  it('is true only for a strictly newer generation', () => {
    expect(isNewerGeneration('4.0', '3.1')).toBe(true);
    expect(isNewerGeneration('3.1', '4.0')).toBe(false);
    expect(isNewerGeneration('3.1', '3.1')).toBe(false);
    expect(isNewerGeneration('4.0', '4.0')).toBe(false);
  });
});

describe('parseGenerations', () => {
  it('reads a comma-separated list', () => {
    expect(parseGenerations('3.1,4.0')).toEqual(['3.1', '4.0']);
    expect(parseGenerations('4.0')).toEqual(['4.0']);
  });

  it('returns them in table order, without repeats', () => {
    expect(parseGenerations('4.0,3.1,4.0')).toEqual(['3.1', '4.0']);
  });

  // An unknown name is dropped.
  it('drops what it does not know', () => {
    expect(parseGenerations('3.1,9.9')).toEqual(['3.1']);
    expect(parseGenerations('any')).toEqual([]);
  });

  it.each([null, undefined, '', 4, {}])('reads %p as none', value => {
    expect(parseGenerations(value)).toEqual([]);
  });
});

describe('parseGenerationsInUse', () => {
  it('keeps a saved selection as it is', () => {
    expect(parseGenerationsInUse('3.1')).toEqual(['3.1']);
    expect(parseGenerationsInUse('4.0')).toEqual(['4.0']);
  });

  // Nothing usable stored means all: a corrupt value must hide nothing.
  it.each([null, undefined, '', 'any', '9.9', 4])(
    'reads %p as every generation',
    value => {
      expect(parseGenerationsInUse(value)).toEqual([...ALL_GENERATIONS]);
    },
  );

  it('does not hand out the shared list itself', () => {
    expect(parseGenerationsInUse(null)).not.toBe(ALL_GENERATIONS);
  });
});

describe('serializeGenerations', () => {
  it('round-trips through the parser', () => {
    expect(parseGenerations(serializeGenerations(['3.1', '4.0']))).toEqual([
      '3.1',
      '4.0',
    ]);
    expect(serializeGenerations([])).toBe('');
  });
});

describe('secureChannelVersion', () => {
  it('is V1 below applet 4.0', () => {
    expect(secureChannelVersion(v3Select(0x0302))).toBe('v1');
  });

  it('is V2 from applet 4.0, including newer applets', () => {
    expect(secureChannelVersion(v4Select(0x0400))).toBe('v2');
    expect(secureChannelVersion(v4Select(0x0500))).toBe('v2');
  });

  it('is V1 for an uninitialized 3.x card, which reports no version', () => {
    expect(secureChannelVersion(blankV3Select())).toBe('v1');
  });
});
