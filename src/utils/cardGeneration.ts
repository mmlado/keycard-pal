/* eslint-disable no-bitwise */
import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

/**
 * A point at which the feature surface Keycard Pal cares about changes, named
 * after the lowest applet version it starts at. Releases and generations are
 * not the same list: a release only earns a generation when it changes what
 * the app can do.
 */
export type Generation = '3.1' | '4.0';

/** Every generation, oldest first. The first one is the floor. */
export const GENERATIONS: readonly {
  generation: Generation;
  minAppletVersion: number;
}[] = [
  { generation: '3.1', minAppletVersion: 0x0301 },
  { generation: '4.0', minAppletVersion: 0x0400 },
];

/**
 * The oldest applet Keycard Pal drives. Below it there is no IDENTIFY CARD, so
 * a card would otherwise work in a degraded, never-verified way; it is refused
 * instead, as keycard-shell does.
 */
export const MIN_SUPPORTED_APPLET_VERSION = GENERATIONS[0].minAppletVersion;

/** An applet version as major.minor, e.g. 0x0301 as "3.1". */
export function formatAppletVersion(version: number): string {
  return `${version >> 8}.${version & 0xff}`;
}

/**
 * The applet version from a SELECT response, or null when the card reported
 * none. An uninitialized 3.x card answers SELECT with a bare secure channel
 * key and no version, so the SDK leaves the field unset even though its type
 * says number.
 */
export function appletVersion(appInfo: ApplicationInfo): number | null {
  return typeof appInfo.appVersion === 'number' ? appInfo.appVersion : null;
}

/**
 * The tapped card's generation, resolved from this tap's SELECT and never
 * stored. Null for a card below the floor.
 *
 * A card with no version is an uninitialized 3.x card (a 4.0 card reports its
 * version even when blank), so it takes the 3.x path and is not refused until
 * it has been initialized and reports one, matching keycard-shell.
 */
export function cardGeneration(appInfo: ApplicationInfo): Generation | null {
  const version = appletVersion(appInfo);
  if (version === null) {
    return GENERATIONS[0].generation;
  }
  let generation: Generation | null = null;
  for (const entry of GENERATIONS) {
    if (version >= entry.minAppletVersion) {
      generation = entry.generation;
    }
  }
  return generation;
}

/** True only when the card reported a version and it is below the floor. */
export function isBelowMinimumVersion(appInfo: ApplicationInfo): boolean {
  return cardGeneration(appInfo) === null;
}

/**
 * Which secure channel protocol a card speaks. Derived from the applet version
 * today, but deliberately a separate attribute from the generation: a later
 * applet could keep V2 while starting a new generation, so anything that
 * depends on the channel asks this, never the generation.
 */
export type SecureChannelVersion = 'v1' | 'v2';

/** The first applet to speak V2, by the same rule the SDK uses to pick its
 *  channel, so Pal and the SDK always agree on which one was opened. */
const SECURE_CHANNEL_V2_MIN_APPLET_VERSION = 0x0400;

/**
 * The secure channel the tapped card speaks. A card that reports no version is
 * an uninitialized 3.x card, which speaks V1.
 */
export function secureChannelVersion(
  appInfo: ApplicationInfo,
): SecureChannelVersion {
  const version = appletVersion(appInfo);
  return version !== null && version >= SECURE_CHANNEL_V2_MIN_APPLET_VERSION
    ? 'v2'
    : 'v1';
}
