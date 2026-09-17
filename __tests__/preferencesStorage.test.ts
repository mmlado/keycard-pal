import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreference,
} from '../src/storage/preferencesStorage';

import { testPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetMany = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getMany: (...args: any[]) => mockGetMany(...args),
    setItem: (...args: any[]) => mockSetItem(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KEYS = {
  dashboardLayout: 'preference_dashboard_layout',
  generationsInUse: 'preference_generations_in_use',
  generationRemindersDismissed: 'preference_generation_reminders_dismissed',
  pinPadScramble: 'preference_pinpad_scramble',
  tokenImagesEnabled: 'preference_token_images_enabled',
  welcomeSeen: 'preference_welcome_seen',
  xpubNoticeDismissed: 'preference_xpub_notice_dismissed',
};

function stored(values: Record<string, string | null>) {
  const all: Record<string, string | null> = {};
  for (const key of Object.values(KEYS)) {
    all[key] = null;
  }
  mockGetMany.mockResolvedValue({ ...all, ...values });
}

beforeEach(() => {
  mockGetMany.mockReset();
  mockSetItem.mockReset();
  mockSetItem.mockResolvedValue(undefined);
  stored({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadPreferences', () => {
  // One read for every preference is the point: nothing else reads storage
  // after startup, so the whole set has to come from this call.
  it('reads every key in one round trip', async () => {
    await loadPreferences();
    expect(mockGetMany).toHaveBeenCalledTimes(1);
    const [keys] = mockGetMany.mock.calls[0];
    expect([...keys].sort()).toEqual(Object.values(KEYS).sort());
  });

  it('returns the defaults when nothing is stored', async () => {
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('decodes every stored value', async () => {
    stored({
      [KEYS.dashboardLayout]: 'list',
      [KEYS.generationsInUse]: '4.0',
      [KEYS.generationRemindersDismissed]: '3.1',
      [KEYS.pinPadScramble]: '1',
      [KEYS.tokenImagesEnabled]: '1',
      [KEYS.welcomeSeen]: '1',
      [KEYS.xpubNoticeDismissed]: '1',
    });
    expect(await loadPreferences()).toEqual({
      dashboardLayout: 'list',
      generationsInUse: ['4.0'],
      generationRemindersDismissed: ['3.1'],
      pinPadScramble: true,
      tokenImagesEnabled: true,
      welcomeSeen: true,
      xpubNoticeDismissed: true,
    });
  });

  it('reads a stored "0" as off', async () => {
    stored({ [KEYS.pinPadScramble]: '0', [KEYS.welcomeSeen]: '0' });
    const preferences = await loadPreferences();
    expect(preferences.pinPadScramble).toBe(false);
    expect(preferences.welcomeSeen).toBe(false);
  });

  // Anything unrecognised falls back rather than rendering an empty screen.
  it('reads anything but "list" as tiles', async () => {
    stored({ [KEYS.dashboardLayout]: 'grid' });
    expect((await loadPreferences()).dashboardLayout).toBe('tiles');
  });

  // A selection nobody recognises must leave nothing out: it could otherwise
  // hide entries the user then has no way to reach.
  it.each(['5.0', '3.0', 'any', 'undefined', ''])(
    'reads an unrecognised selection %p as every generation',
    async value => {
      stored({ [KEYS.generationsInUse]: value });
      expect((await loadPreferences()).generationsInUse).toEqual([
        '3.1',
        '4.0',
      ]);
    },
  );

  // A saved selection is kept as it is, so a generation a later version adds
  // arrives unticked: most users will not own the new card when it ships.
  it('keeps a saved selection narrower than the table', async () => {
    stored({ [KEYS.generationsInUse]: '3.1' });
    expect((await loadPreferences()).generationsInUse).toEqual(['3.1']);
  });

  it('reads no dismissed reminders when nothing usable is stored', async () => {
    stored({ [KEYS.generationRemindersDismissed]: 'garbage' });
    expect((await loadPreferences()).generationRemindersDismissed).toEqual([]);
  });

  it('hands out its own copy of the default selection', async () => {
    const first = await loadPreferences();
    first.generationsInUse.pop();
    expect((await loadPreferences()).generationsInUse).toEqual(['3.1', '4.0']);
  });

  // Startup gates on this read, so a storage failure must resolve, not
  // reject, or the app never gets past the loading screen.
  it('returns the defaults when storage throws', async () => {
    mockGetMany.mockRejectedValue(new Error('storage failure'));
    const preferences = await loadPreferences();
    expect(preferences).toEqual(DEFAULT_PREFERENCES);
    expect(preferences).not.toBe(DEFAULT_PREFERENCES);
  });
});

// Screen tests build their mocked preferences from this helper. If it drifts
// from the real defaults, those tests describe an app that does not exist.
describe('testPreferences', () => {
  it('matches the real defaults', () => {
    expect(testPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('lays overrides over the defaults', () => {
    expect(testPreferences({ dashboardLayout: 'list' })).toEqual({
      ...DEFAULT_PREFERENCES,
      dashboardLayout: 'list',
    });
  });

  it('hands out fresh lists each time', () => {
    testPreferences().generationsInUse.pop();
    expect(testPreferences().generationsInUse).toEqual(['3.1', '4.0']);
  });
});

describe('savePreference', () => {
  it.each([
    ['pinPadScramble', KEYS.pinPadScramble],
    ['tokenImagesEnabled', KEYS.tokenImagesEnabled],
    ['welcomeSeen', KEYS.welcomeSeen],
    ['xpubNoticeDismissed', KEYS.xpubNoticeDismissed],
  ] as const)('stores %s as "1" / "0"', async (name, key) => {
    await savePreference(name, true);
    expect(mockSetItem).toHaveBeenCalledWith(key, '1');

    await savePreference(name, false);
    expect(mockSetItem).toHaveBeenCalledWith(key, '0');
  });

  it('stores the layout verbatim', async () => {
    await savePreference('dashboardLayout', 'list');
    expect(mockSetItem).toHaveBeenCalledWith(KEYS.dashboardLayout, 'list');

    await savePreference('dashboardLayout', 'tiles');
    expect(mockSetItem).toHaveBeenCalledWith(KEYS.dashboardLayout, 'tiles');
  });

  it('stores a list of generations comma-separated', async () => {
    await savePreference('generationsInUse', ['3.1', '4.0']);
    expect(mockSetItem).toHaveBeenCalledWith(KEYS.generationsInUse, '3.1,4.0');

    await savePreference('generationRemindersDismissed', ['4.0']);
    expect(mockSetItem).toHaveBeenCalledWith(
      KEYS.generationRemindersDismissed,
      '4.0',
    );
  });

  // The provider decides what a failed write means for the UI, so the
  // failure has to reach it.
  it('rejects when storage does', async () => {
    mockSetItem.mockRejectedValue(new Error('storage full'));
    await expect(savePreference('pinPadScramble', true)).rejects.toThrow(
      'storage full',
    );
  });
});
