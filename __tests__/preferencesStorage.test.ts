import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreference,
} from '../src/storage/preferencesStorage';

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
  minGeneration: 'preference_min_generation',
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
      [KEYS.minGeneration]: '4.0',
      [KEYS.pinPadScramble]: '1',
      [KEYS.tokenImagesEnabled]: '1',
      [KEYS.welcomeSeen]: '1',
      [KEYS.xpubNoticeDismissed]: '1',
    });
    expect(await loadPreferences()).toEqual({
      dashboardLayout: 'list',
      minGeneration: '4.0',
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

  // A value that names no known generation must hide nothing: it could
  // otherwise hide entries the user then has no way to reach.
  it.each(['5.0', '3.0', 'undefined', ''])(
    'reads an unrecognised minimum generation %p as any',
    async value => {
      stored({ [KEYS.minGeneration]: value });
      expect((await loadPreferences()).minGeneration).toBe('any');
    },
  );

  // Startup gates on this read, so a storage failure must resolve, not
  // reject, or the app never gets past the loading screen.
  it('returns the defaults when storage throws', async () => {
    mockGetMany.mockRejectedValue(new Error('storage failure'));
    const preferences = await loadPreferences();
    expect(preferences).toEqual(DEFAULT_PREFERENCES);
    expect(preferences).not.toBe(DEFAULT_PREFERENCES);
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

  it('stores the minimum generation verbatim', async () => {
    await savePreference('minGeneration', '4.0');
    expect(mockSetItem).toHaveBeenCalledWith(KEYS.minGeneration, '4.0');

    await savePreference('minGeneration', 'any');
    expect(mockSetItem).toHaveBeenCalledWith(KEYS.minGeneration, 'any');
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
