/* eslint-disable no-bitwise */
import { ApplicationInfo } from 'keycard-sdk/dist/application-info';

import {
  appletVersion,
  cardGeneration,
  formatAppletVersion,
  GENERATIONS,
  isBelowMinimumVersion,
  MIN_SUPPORTED_APPLET_VERSION,
} from '../src/utils/cardGeneration';

function tlv(tag: number, value: number[]): number[] {
  return [tag, value.length, ...value];
}

function filler(length: number): number[] {
  return new Array(length).fill(0x01);
}

function versionBytes(version: number): number[] {
  return [version >> 8, version & 0xff];
}

/** An initialized 3.x SELECT response: instance UID, secure channel key,
 *  version, free pairing slots, key UID, capabilities. */
function v3Select(version: number): ApplicationInfo {
  const body = [
    ...tlv(0x8f, filler(16)),
    ...tlv(0x80, filler(65)),
    ...tlv(0x02, versionBytes(version)),
    ...tlv(0x02, [5]),
    ...tlv(0x8e, []),
    ...tlv(0x8d, [0x1f]),
  ];
  return new ApplicationInfo(new Uint8Array(tlv(0xa4, body)));
}

/** A 4.0 SELECT response: version, status, key UID, capabilities,
 *  certificate. No instance UID, no secure channel key, no pairing slots. */
function v4Select(version: number, status = 0x13): ApplicationInfo {
  const body = [
    ...tlv(0x02, versionBytes(version)),
    ...tlv(0x8c, [status]),
    ...tlv(0x8e, []),
    ...tlv(0x8d, [0x1f]),
    ...tlv(0x8a, filler(98)),
  ];
  return new ApplicationInfo(new Uint8Array(tlv(0xa4, body)));
}

/** An uninitialized 3.x card answers with a bare secure channel key. */
function blankV3Select(): ApplicationInfo {
  return new ApplicationInfo(new Uint8Array(tlv(0x80, filler(65))));
}

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
    expect(cardGeneration(v4Select(0x0400, 0x00))).toBe('4.0');
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
