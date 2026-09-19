import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ALL_GENERATIONS,
  Generation,
  parseGenerations,
  parseGenerationsInUse,
  serializeGenerations,
} from '@/utils/cardGeneration';

/** How the dashboard renders its destinations. */
export type DashboardLayout = 'tiles' | 'list';

/** Every stored UI preference. Read once at startup by `PreferencesProvider` (ADR-0011). */
export type Preferences = {
  dashboardLayout: DashboardLayout;
  /** The cards the user holds, all by default. Hides entries and taps; never refuses a card. */
  generationsInUse: Generation[];
  /** Generations whose dashboard reminder the user closed for good. */
  generationRemindersDismissed: Generation[];
  pinPadScramble: boolean;
  tokenImagesEnabled: boolean;
  welcomeSeen: boolean;
  xpubNoticeDismissed: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  dashboardLayout: 'tiles',
  generationsInUse: [...ALL_GENERATIONS],
  generationRemindersDismissed: [],
  pinPadScramble: false,
  tokenImagesEnabled: false,
  welcomeSeen: false,
  xpubNoticeDismissed: false,
};

/** Opt-in features end in `_enabled`, so unset reads as off (ADR-0003). Booleans are '1' / '0'. */
const KEYS: Record<keyof Preferences, string> = {
  dashboardLayout: 'preference_dashboard_layout',
  generationsInUse: 'preference_generations_in_use',
  generationRemindersDismissed: 'preference_generation_reminders_dismissed',
  pinPadScramble: 'preference_pinpad_scramble',
  tokenImagesEnabled: 'preference_token_images_enabled',
  welcomeSeen: 'preference_welcome_seen',
  xpubNoticeDismissed: 'preference_xpub_notice_dismissed',
};

/** One round trip. Never rejects: a failed read yields the defaults. */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await AsyncStorage.getMany(Object.values(KEYS));
    const flag = (key: keyof Preferences) => stored[KEYS[key]] === '1';
    return {
      // Anything but an explicit 'list' means tiles.
      dashboardLayout:
        stored[KEYS.dashboardLayout] === 'list' ? 'list' : 'tiles',
      generationsInUse: parseGenerationsInUse(stored[KEYS.generationsInUse]),
      generationRemindersDismissed: parseGenerations(
        stored[KEYS.generationRemindersDismissed],
      ),
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
  if (typeof value === 'string') {
    return value;
  }
  return serializeGenerations(value);
}

/** Rejects when storage does; the provider then rolls the value back. */
export async function savePreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): Promise<void> {
  await AsyncStorage.setItem(KEYS[key], encode(value));
}
