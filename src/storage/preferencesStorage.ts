import AsyncStorage from '@react-native-async-storage/async-storage';

import { MinGeneration, parseMinGeneration } from '@/utils/cardGeneration';

/** How the dashboard renders its destinations. */
export type DashboardLayout = 'tiles' | 'list';

/**
 * Every persisted, non-sensitive UI preference. Resolved once at startup by
 * `PreferencesProvider` and handed down by context; nothing reads a single
 * preference later, so no screen can paint a default and then flicker to the
 * stored value.
 */
export type Preferences = {
  dashboardLayout: DashboardLayout;
  /** Hides menu entries older cards alone have; never refuses a card. */
  minGeneration: MinGeneration;
  pinPadScramble: boolean;
  tokenImagesEnabled: boolean;
  welcomeSeen: boolean;
  xpubNoticeDismissed: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  dashboardLayout: 'tiles',
  minGeneration: 'any',
  pinPadScramble: false,
  tokenImagesEnabled: false,
  welcomeSeen: false,
  xpubNoticeDismissed: false,
};

/**
 * Storage key per preference. Opt-in network features use the `_enabled`
 * suffix so the unset state reads as disabled (ADR-0003). Booleans are stored
 * as '1' / '0'; the layout and the minimum generation are stored verbatim.
 */
const KEYS: Record<keyof Preferences, string> = {
  dashboardLayout: 'preference_dashboard_layout',
  minGeneration: 'preference_min_generation',
  pinPadScramble: 'preference_pinpad_scramble',
  tokenImagesEnabled: 'preference_token_images_enabled',
  welcomeSeen: 'preference_welcome_seen',
  xpubNoticeDismissed: 'preference_xpub_notice_dismissed',
};

/**
 * Reads every preference in one round trip. Never rejects: a failed read
 * yields the defaults, so startup cannot stall on storage.
 */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await AsyncStorage.getMany(Object.values(KEYS));
    const flag = (key: keyof Preferences) => stored[KEYS[key]] === '1';
    return {
      // Anything but an explicit 'list' means tiles, so the default survives
      // a missing, empty or unrecognised value.
      dashboardLayout:
        stored[KEYS.dashboardLayout] === 'list' ? 'list' : 'tiles',
      minGeneration: parseMinGeneration(stored[KEYS.minGeneration]),
      pinPadScramble: flag('pinPadScramble'),
      tokenImagesEnabled: flag('tokenImagesEnabled'),
      welcomeSeen: flag('welcomeSeen'),
      xpubNoticeDismissed: flag('xpubNoticeDismissed'),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function encode(value: Preferences[keyof Preferences]): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return value;
}

/**
 * Writes one preference. Rejects when storage does; `PreferencesProvider`
 * turns that into a rollback of the value it shows.
 */
export async function savePreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): Promise<void> {
  await AsyncStorage.setItem(KEYS[key], encode(value));
}
