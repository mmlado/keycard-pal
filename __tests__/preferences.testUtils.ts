import type { Preferences } from '../src/storage/preferencesStorage';

/**
 * A complete `Preferences` record for tests that mock `usePreferences`. Not a
 * test suite: jest.config.js ignores *testUtils.ts.
 *
 * A mock that lists only the preferences its own test cares about breaks the
 * day the component under it starts reading another one, and it breaks at
 * runtime with a TypeError about `undefined`, far from the cause. Spreading
 * these defaults under the overrides keeps such a mock whole. It is typed, so
 * adding a preference fails the type check here until it has a default, and
 * preferencesStorage.test.ts holds it equal to the real DEFAULT_PREFERENCES.
 *
 * The storage module is imported for its type only, which is erased, so using
 * this never pulls AsyncStorage into a screen test.
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
