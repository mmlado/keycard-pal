/* eslint-disable no-bitwise */
import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

/**
 * A point at which the feature surface Keycard Pal cares about changes, named
 * after the lowest applet version it starts at. Releases and generations are
 * not the same list: a release only earns a generation when it changes what
 * the app can do.
 */
export type Generation = '3.1' | '4.0';

/**
 * Every generation, oldest first. The first one is the floor.
 *
 * `label` is how the generation is named to the user. It is written by hand
 * rather than derived from the version: a generation can start mid-major, where
 * a computed "4.x" would name two of them.
 */
export const GENERATIONS: readonly {
  generation: Generation;
  minAppletVersion: number;
  label: string;
}[] = [
  { generation: '3.1', minAppletVersion: 0x0301, label: '3.x' },
  { generation: '4.0', minAppletVersion: 0x0400, label: '4.x' },
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

/** How a generation is named to the user, e.g. "3.x". */
export function generationLabel(generation: Generation): string {
  return (
    GENERATIONS.find(entry => entry.generation === generation)?.label ??
    generation
  );
}

/** True when `generation` is strictly newer than `other`. */
export function isNewerGeneration(
  generation: Generation,
  other: Generation,
): boolean {
  const rank = (known: Generation) =>
    GENERATIONS.findIndex(entry => entry.generation === known);
  return rank(generation) > rank(other);
}

/** Every generation, in order. What a user who never chose has ticked. */
export const ALL_GENERATIONS: readonly Generation[] = GENERATIONS.map(
  entry => entry.generation,
);

/**
 * A stored list of generations, as the known ones among its comma-separated
 * parts, in table order and without repeats. Anything else in it is dropped:
 * a name this version does not know cannot be shown or acted on.
 */
export function parseGenerations(stored: unknown): Generation[] {
  const parts = typeof stored === 'string' ? stored.split(',') : [];
  return ALL_GENERATIONS.filter(generation => parts.includes(generation));
}

/**
 * The generations the user ticked as the cards they hold, from storage.
 *
 * Nothing usable stored means all of them. That is the fresh install, and it
 * is also the only safe reading of a value nobody recognises: leaving entries
 * out on the strength of a corrupt preference could hide what the user then
 * has no way to reach. A saved selection is kept as it is, so a generation
 * added by a later version arrives unticked: most users will not own the new
 * card when it ships, and tapping one is what asks them.
 */
export function parseGenerationsInUse(stored: unknown): Generation[] {
  const known = parseGenerations(stored);
  return known.length > 0 ? known : [...ALL_GENERATIONS];
}

export function serializeGenerations(generations: Generation[]): string {
  return generations.join(',');
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
