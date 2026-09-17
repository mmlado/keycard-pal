import {
  appletVersion,
  cardGeneration,
  effectiveMinGeneration,
  formatAppletVersion,
  GENERATIONS,
  isBelowMinimumVersion,
  isNewerGeneration,
  isPastGeneration,
  MIN_SUPPORTED_APPLET_VERSION,
  minGenerationLabel,
  parseMinGeneration,
  secureChannelVersion,
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

describe('parseMinGeneration', () => {
  it('keeps a known generation', () => {
    expect(parseMinGeneration('3.1')).toBe('3.1');
    expect(parseMinGeneration('4.0')).toBe('4.0');
  });

  // Hiding nothing is the only safe reading of a value nobody recognises.
  it.each([null, undefined, '', 'any', '5.0', '3.0', 4])(
    'reads %p as any',
    value => {
      expect(parseMinGeneration(value)).toBe('any');
    },
  );
});

describe('effectiveMinGeneration', () => {
  it('treats any as the floor, since nothing older is driven at all', () => {
    expect(effectiveMinGeneration('any')).toBe(GENERATIONS[0].generation);
  });

  it('keeps a declared generation', () => {
    expect(effectiveMinGeneration('4.0')).toBe('4.0');
  });

  it('falls back to the floor for a value it does not know', () => {
    expect(effectiveMinGeneration('9.9' as any)).toBe('3.1');
  });
});

describe('minGenerationLabel', () => {
  it('names the minimum applet version', () => {
    expect(minGenerationLabel('3.1')).toBe('3.1 or newer');
    expect(minGenerationLabel('4.0')).toBe('4.0 or newer');
  });

  it('names the floor when nothing was declared', () => {
    expect(minGenerationLabel('any')).toBe('3.1 or newer');
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

describe('isPastGeneration', () => {
  it('is false while nothing is declared', () => {
    expect(isPastGeneration('any', '3.1')).toBe(false);
  });

  it('is false when the declared cards still belong to that generation', () => {
    expect(isPastGeneration('3.1', '3.1')).toBe(false);
    expect(isPastGeneration('3.1', '4.0')).toBe(false);
    expect(isPastGeneration('4.0', '4.0')).toBe(false);
  });

  it('is true once every declared card is newer', () => {
    expect(isPastGeneration('4.0', '3.1')).toBe(true);
  });

  // Screen tests hand over partial preferences, and a corrupt value must not
  // hide anything either.
  it('is false for a minimum it does not know', () => {
    expect(isPastGeneration(undefined as any, '3.1')).toBe(false);
    expect(isPastGeneration('9.9' as any, '3.1')).toBe(false);
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
