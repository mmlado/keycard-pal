import type { Preferences } from '../src/storage/preferencesStorage';

/**
 * A complete `Preferences` record for tests that mock `usePreferences`, so a partial mock cannot
 * break when a component reads another preference. Typed, and held equal to DEFAULT_PREFERENCES
 * by preferencesStorage.test.ts. Not a suite: jest ignores *testUtils.ts.
 */
const DEFAULTS: Preferences = {
  dashboardLayout: 'tiles',
  generationsInUse: ['3.1', '4.0'],
  generationRemindersDismissed: [],
  pinPadScramble: false,
  tokenImagesEnabled: false,
  welcomeSeen: false,
  xpubNoticeDismissed: false,
};

export function testPreferences(
  overrides: Partial<Preferences> = {},
): Preferences {
  return {
    ...DEFAULTS,
    // Fresh arrays, so one test mutating a list cannot leak into the next.
    generationsInUse: [...DEFAULTS.generationsInUse],
    generationRemindersDismissed: [...DEFAULTS.generationRemindersDismissed],
    ...overrides,
  };
}
