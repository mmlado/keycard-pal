import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook, screen } from '@testing-library/react-native';

import { LOADING_FADE_MS } from '../src/components/LoadingScreen';
import { usePreferences } from '../src/hooks/usePreferences';
import { PreferencesProvider } from '../src/providers/preferences/Provider';
import type { Preferences } from '../src/storage/preferencesStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLoad = jest.fn();
const mockSave = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadPreferences: () => mockLoad(),
  savePreference: (...args: unknown[]) => mockSave(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORED: Preferences = {
  dashboardLayout: 'list',
  generationsInUse: ['3.1', '4.0'],
  generationRemindersDismissed: [],
  pinPadScramble: true,
  tokenImagesEnabled: false,
  welcomeSeen: true,
  xpubNoticeDismissed: false,
};

function Probe() {
  const { preferences } = usePreferences();
  return <Text>{`layout:${preferences.dashboardLayout}`}</Text>;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}

/** Renders the hook under the provider and waits for the startup read. */
async function renderPreferences() {
  const rendered = renderHook(() => usePreferences(), { wrapper });
  await act(async () => {});
  return rendered;
}

/** A write whose outcome the test decides later. */
function deferredSave() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  mockSave.mockReturnValueOnce(
    new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    }),
  );
  return { resolve: () => resolve(), reject: (e: Error) => reject(e) };
}

/** A write that has failed before the provider issues it. */
function failedSave() {
  const failure = Promise.reject(new Error('storage full'));
  // Handled here too, so the rejection is never loose while it waits its turn.
  failure.catch(() => {});
  mockSave.mockReturnValueOnce(failure);
}

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
  mockLoad.mockResolvedValue({ ...STORED });
  mockSave.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreferencesProvider', () => {
  describe('startup', () => {
    // Children never paint a default first.
    it('shows the loading screen and holds children until the read resolves', async () => {
      let resolveLoad!: (value: Preferences) => void;
      mockLoad.mockReturnValue(
        new Promise<Preferences>(resolve => {
          resolveLoad = resolve;
        }),
      );

      render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>,
      );
      expect(screen.getByTestId('loading-screen')).toBeTruthy();
      expect(screen.queryByText(/layout:/)).toBeNull();

      await act(async () => {
        resolveLoad({ ...STORED });
      });
      expect(screen.getByText('layout:list')).toBeTruthy();
    });

    // The loading screen stays mounted until its fade ends.
    it('keeps the loading screen above the children until it has faded', async () => {
      render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>,
      );
      await act(async () => {});
      expect(screen.getByText('layout:list')).toBeTruthy();
      expect(screen.getByTestId('loading-screen')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(LOADING_FADE_MS * 2);
      });
      expect(screen.queryByTestId('loading-screen')).toBeNull();
      expect(screen.getByText('layout:list')).toBeTruthy();
    });

    it('reads storage exactly once', async () => {
      await renderPreferences();
      expect(mockLoad).toHaveBeenCalledTimes(1);
    });

    it('hands the stored values to consumers', async () => {
      const { result } = await renderPreferences();
      expect(result.current.preferences).toEqual(STORED);
    });

    it('does not commit a read that lands after unmount', async () => {
      let resolveLoad!: (value: Preferences) => void;
      mockLoad.mockReturnValue(
        new Promise<Preferences>(resolve => {
          resolveLoad = resolve;
        }),
      );
      const { unmount } = render(
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>,
      );
      unmount();
      await expect(
        act(async () => {
          resolveLoad({ ...STORED });
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('usePreferences', () => {
    it('throws outside the provider', () => {
      expect(() => renderHook(() => usePreferences())).toThrow(
        'usePreferences must be used inside PreferencesProvider',
      );
    });
  });

  describe('setPreference', () => {
    it('shows the new value at once and writes it', async () => {
      const pending = deferredSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('dashboardLayout', 'tiles');
      });
      expect(result.current.preferences.dashboardLayout).toBe('tiles');
      expect(mockSave).toHaveBeenCalledWith('dashboardLayout', 'tiles');

      await act(async () => {
        pending.resolve();
      });
      expect(result.current.preferences.dashboardLayout).toBe('tiles');
    });

    it('leaves the other preferences untouched', async () => {
      const { result } = await renderPreferences();
      await act(async () => {
        await result.current.setPreference('xpubNoticeDismissed', true);
      });
      expect(result.current.preferences).toEqual({
        ...STORED,
        xpubNoticeDismissed: true,
      });
    });

    it('skips the write when the value is unchanged', async () => {
      const { result } = await renderPreferences();
      await act(async () => {
        await result.current.setPreference('pinPadScramble', true);
      });
      expect(mockSave).not.toHaveBeenCalled();
    });

    // A failed write puts the shown value back.
    it('rolls back when the write fails', async () => {
      const pending = deferredSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('pinPadScramble', false);
      });
      expect(result.current.preferences.pinPadScramble).toBe(false);

      await act(async () => {
        pending.reject(new Error('storage full'));
      });
      expect(result.current.preferences.pinPadScramble).toBe(true);
    });

    it('never rejects, so callers need not catch', async () => {
      mockSave.mockRejectedValue(new Error('storage full'));
      const { result } = await renderPreferences();
      await expect(
        act(() => result.current.setPreference('welcomeSeen', false)),
      ).resolves.toBeUndefined();
    });

    // A slow failure must not undo a choice the user made after it.
    it('does not roll back a value a newer write has replaced', async () => {
      const first = deferredSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('dashboardLayout', 'tiles');
      });
      // Not awaited: the second write is queued behind the first.
      await act(async () => {
        result.current.setPreference('dashboardLayout', 'list');
      });
      await act(async () => {
        first.reject(new Error('storage full'));
      });

      expect(result.current.preferences.dashboardLayout).toBe('list');
    });

    it('rolls the latest write back to the last stored value', async () => {
      const { result } = await renderPreferences();
      await act(async () => {
        await result.current.setPreference('dashboardLayout', 'tiles');
      });

      const second = deferredSave();
      await act(async () => {
        result.current.setPreference('dashboardLayout', 'list');
      });
      expect(result.current.preferences.dashboardLayout).toBe('list');

      await act(async () => {
        second.reject(new Error('storage full'));
      });
      expect(result.current.preferences.dashboardLayout).toBe('tiles');
    });

    // A rollback goes to what storage holds, never to an optimistic value.
    it('rolls back to the stored value when consecutive writes fail', async () => {
      const first = deferredSave();
      const second = deferredSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('tokenImagesEnabled', true);
      });
      await act(async () => {
        result.current.setPreference('tokenImagesEnabled', false);
      });

      await act(async () => {
        first.reject(new Error('storage full'));
      });
      await act(async () => {
        second.reject(new Error('storage full'));
      });

      expect(result.current.preferences.tokenImagesEnabled).toBe(
        STORED.tokenImagesEnabled,
      );
    });

    // Writes to one key are issued one after the other.
    it('holds a write to a key until the write before it settles', async () => {
      const first = deferredSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('tokenImagesEnabled', true);
      });
      await act(async () => {
        result.current.setPreference('tokenImagesEnabled', false);
      });
      expect(mockSave).toHaveBeenCalledTimes(1);

      await act(async () => {
        first.resolve();
      });
      expect(mockSave).toHaveBeenCalledTimes(2);
      expect(mockSave).toHaveBeenLastCalledWith('tokenImagesEnabled', false);
    });

    // Unordered, a rollback could go past a value storage kept.
    it('rolls a failed write back to what the write before it stored', async () => {
      const first = deferredSave();
      failedSave();
      const { result } = await renderPreferences();

      await act(async () => {
        result.current.setPreference('dashboardLayout', 'tiles');
      });
      await act(async () => {
        result.current.setPreference('dashboardLayout', 'list');
      });

      await act(async () => {
        first.resolve();
      });

      expect(result.current.preferences.dashboardLayout).toBe('tiles');
    });

    // A later failure rolls back to the last successful write.
    it('rolls back to a value an earlier write stored successfully', async () => {
      const { result } = await renderPreferences();
      await act(async () => {
        await result.current.setPreference('tokenImagesEnabled', true);
      });

      const failing = deferredSave();
      await act(async () => {
        result.current.setPreference('tokenImagesEnabled', false);
      });
      await act(async () => {
        failing.reject(new Error('storage full'));
      });

      expect(result.current.preferences.tokenImagesEnabled).toBe(true);
    });

    // Writes to different preferences compose.
    it('composes writes to different preferences', async () => {
      const { result } = await renderPreferences();
      await act(async () => {
        result.current.setPreference('welcomeSeen', false);
        result.current.setPreference('xpubNoticeDismissed', true);
      });
      expect(result.current.preferences.welcomeSeen).toBe(false);
      expect(result.current.preferences.xpubNoticeDismissed).toBe(true);
    });
  });
});
