/* eslint-disable no-bitwise */
import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

/** A point where what the app can do with a card changes. Not every applet release is one. */
export type Generation = '3.1' | '4.0';

/** Oldest first; the first is the floor. `label` is hand-written: a generation can start mid-major. */
export const GENERATIONS: readonly {
  generation: Generation;
  minAppletVersion: number;
  label: string;
}[] = [
  { generation: '3.1', minAppletVersion: 0x0301, label: '3.x' },
  { generation: '4.0', minAppletVersion: 0x0400, label: '4.x' },
];

/** Below this there is no IDENTIFY CARD, so the card is refused, as keycard-shell does. */
export const MIN_SUPPORTED_APPLET_VERSION = GENERATIONS[0].minAppletVersion;

/** An applet version as major.minor, e.g. 0x0301 as "3.1". */
export function formatAppletVersion(version: number): string {
  return `${version >> 8}.${version & 0xff}`;
}

/** Null when the card reported none: a blank 3.x card answers SELECT without a version. */
export function appletVersion(appInfo: ApplicationInfo): number | null {
  return typeof appInfo.appVersion === 'number' ? appInfo.appVersion : null;
}

/** Derived per tap, never stored. Null below the floor. No version means a blank 3.x card. */
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

/** The known generations in a stored comma list, in table order, without repeats. */
export function parseGenerations(stored: unknown): Generation[] {
  const parts = typeof stored === 'string' ? stored.split(',') : [];
  return ALL_GENERATIONS.filter(generation => parts.includes(generation));
}

/**
 * Nothing usable stored means all: a corrupt value must not hide anything. A saved selection is
 * kept as it is, so a generation added later arrives unticked.
 */
export function parseGenerationsInUse(stored: unknown): Generation[] {
  const known = parseGenerations(stored);
  return known.length > 0 ? known : [...ALL_GENERATIONS];
}

export function serializeGenerations(generations: Generation[]): string {
  return generations.join(',');
}

/** A separate axis from the generation on purpose: a later applet could keep V2. */
export type SecureChannelVersion = 'v1' | 'v2';

/** The same threshold the SDK uses to pick its channel. */
const SECURE_CHANNEL_V2_MIN_APPLET_VERSION = 0x0400;

/** A card that reports no version is a blank 3.x card, which speaks V1. */
export function secureChannelVersion(
  appInfo: ApplicationInfo,
): SecureChannelVersion {
  const version = appletVersion(appInfo);
  return version !== null && version >= SECURE_CHANNEL_V2_MIN_APPLET_VERSION
    ? 'v2'
    : 'v1';
}
