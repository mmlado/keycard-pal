import { act, renderHook } from '@testing-library/react-native';

import { usePinPadScramble } from '../src/hooks/usePinPadScramble';

jest.mock('../src/storage/preferencesStorage', () => ({
  loadBooleanPreference: jest.fn().mockResolvedValue(false),
  preferenceKeys: { pinPadScramble: 'preference_pinpad_scramble' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .requireMock('../src/storage/preferencesStorage')
    .loadBooleanPreference.mockResolvedValue(false);
});

it('returns false by default', async () => {
  const { result } = renderHook(() => usePinPadScramble());
  await act(async () => {});
  expect(result.current).toBe(false);
});

it('returns true when preference is enabled', async () => {
  jest
    .requireMock('../src/storage/preferencesStorage')
    .loadBooleanPreference.mockResolvedValue(true);
  const { result } = renderHook(() => usePinPadScramble());
  await act(async () => {});
  expect(result.current).toBe(true);
});

it('falls back to false when storage throws', async () => {
  jest
    .requireMock('../src/storage/preferencesStorage')
    .loadBooleanPreference.mockRejectedValue(new Error('storage error'));
  const { result } = renderHook(() => usePinPadScramble());
  await act(async () => {});
  expect(result.current).toBe(false);
});

it('does not update state after unmount', async () => {
  let resolve!: (v: boolean) => void;
  jest
    .requireMock('../src/storage/preferencesStorage')
    .loadBooleanPreference.mockReturnValue(
      new Promise(r => {
        resolve = r;
      }),
    );
  const { result, unmount } = renderHook(() => usePinPadScramble());
  unmount();
  await act(async () => {
    resolve(true);
  });
  expect(result.current).toBe(false);
});
