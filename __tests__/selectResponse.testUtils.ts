/* eslint-disable no-bitwise */
import { ApplicationInfo } from 'keycard-sdk/dist/application-info';

/**
 * SELECT responses built as the bytes a card sends and parsed by the real SDK,
 * so tests exercise what an actual card returns rather than a hand-made
 * ApplicationInfo. Not a test suite: jest.config.js ignores *testUtils.ts.
 */

function berLength(length: number): number[] {
  if (length < 0x80) {
    return [length];
  }
  if (length < 0x100) {
    return [0x81, length];
  }
  return [0x82, length >> 8, length & 0xff];
}

function tlv(tag: number, value: number[]): number[] {
  return [tag, ...berLength(value.length), ...value];
}

export function filler(length: number, byte = 0x01): number[] {
  return new Array(length).fill(byte);
}

function versionBytes(version: number): number[] {
  return [version >> 8, version & 0xff];
}

/** An initialized 3.x card: instance UID, secure channel key, version, free
 *  pairing slots, key UID, capabilities. */
export function v3Select(
  version: number,
  options: { instanceUID?: number[]; keyUID?: number[] } = {},
): ApplicationInfo {
  const body = [
    ...tlv(0x8f, options.instanceUID ?? filler(16)),
    ...tlv(0x80, filler(65)),
    ...tlv(0x02, versionBytes(version)),
    ...tlv(0x02, [5]),
    ...tlv(0x8e, options.keyUID ?? []),
    ...tlv(0x8d, [0x1f]),
  ];
  return new ApplicationInfo(new Uint8Array(tlv(0xa4, body)));
}

/** A 4.0 card: version, status, key UID, capabilities, certificate. No
 *  instance UID, no secure channel key, no pairing slots. Pass
 *  `certificate: null` for a card that carries none, as a self-flashed
 *  development card may. */
export function v4Select(
  version: number,
  options: {
    status?: number;
    keyUID?: number[];
    certificate?: number[] | null;
  } = {},
): ApplicationInfo {
  const certificate =
    options.certificate === null
      ? []
      : tlv(0x8a, options.certificate ?? filler(98));
  const body = [
    ...tlv(0x02, versionBytes(version)),
    ...tlv(0x8c, [options.status ?? 0x13]),
    ...tlv(0x8e, options.keyUID ?? []),
    ...tlv(0x8d, [0x1f]),
    ...certificate,
  ];
  return new ApplicationInfo(new Uint8Array(tlv(0xa4, body)));
}

/** An uninitialized 3.x card answers with a bare secure channel key. */
export function blankV3Select(): ApplicationInfo {
  return new ApplicationInfo(new Uint8Array(tlv(0x80, filler(65))));
}
