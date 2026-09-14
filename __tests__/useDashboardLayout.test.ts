import { act, renderHook } from '@testing-library/react-native';

import {
  setDashboardLayout,
  useDashboardLayout,
} from '../src/hooks/useDashboardLayout';

jest.mock('../src/storage/preferencesStorage', () => ({
  loadDashboardLayout: jest.fn().mockResolvedValue('tiles'),
  saveDashboardLayout: jest.fn().mockResolvedValue(undefined),
}));

function storage() {
  return jest.requireMock('../src/storage/preferencesStorage');
}

beforeEach(() => {
  jest.clearAllMocks();
  storage().loadDashboardLayout.mockResolvedValue('tiles');
});

it('reports tiles before the stored value arrives', () => {
  const { result } = renderHook(() => useDashboardLayout());
  expect(result.current.layout).toBe('tiles');
  expect(result.current.loaded).toBe(false);
});

it('marks itself loaded once the preference resolves', async () => {
  const { result } = renderHook(() => useDashboardLayout());
  await act(async () => {});
  expect(result.current.loaded).toBe(true);
  expect(result.current.layout).toBe('tiles');
});

it('returns the stored layout', async () => {
  storage().loadDashboardLayout.mockResolvedValue('list');
  const { result } = renderHook(() => useDashboardLayout());
  await act(async () => {});
  expect(result.current.layout).toBe('list');
});

// A failed read must still release the gate, or the dashboard never paints.
it('falls back to tiles and still loads when storage throws', async () => {
  storage().loadDashboardLayout.mockRejectedValue(new Error('storage error'));
  const { result } = renderHook(() => useDashboardLayout());
  await act(async () => {});
  expect(result.current.layout).toBe('tiles');
  expect(result.current.loaded).toBe(true);
});

// Several screens can be mounted at once, so a write has to reach all of them
// and not only the screen that made it.
it('re-reads in every mounted consumer when the layout is set', async () => {
  const first = renderHook(() => useDashboardLayout());
  const second = renderHook(() => useDashboardLayout());
  await act(async () => {});
  expect(first.result.current.layout).toBe('tiles');
  expect(second.result.current.layout).toBe('tiles');

  storage().loadDashboardLayout.mockResolvedValue('list');
  await act(async () => {
    await setDashboardLayout('list');
  });

  expect(storage().saveDashboardLayout).toHaveBeenCalledWith('list');
  expect(first.result.current.layout).toBe('list');
  expect(second.result.current.layout).toBe('list');
});

it('stops listening once unmounted', async () => {
  const { result, unmount } = renderHook(() => useDashboardLayout());
  await act(async () => {});
  unmount();

  storage().loadDashboardLayout.mockResolvedValue('list');
  await act(async () => {
    await setDashboardLayout('list');
  });
  expect(result.current.layout).toBe('tiles');
});

it('does not update state after unmount', async () => {
  let resolve!: (value: string) => void;
  storage().loadDashboardLayout.mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  const { result, unmount } = renderHook(() => useDashboardLayout());
  unmount();
  await act(async () => {
    resolve('list');
  });
  expect(result.current.layout).toBe('tiles');
  expect(result.current.loaded).toBe(false);
});

// The failure path needs the same guard as the success path: a read that
// rejects after the screen is gone must not touch state either.
it('does not update state when the read fails after unmount', async () => {
  let reject!: (error: Error) => void;
  storage().loadDashboardLayout.mockReturnValue(
    new Promise((_, r) => {
      reject = r;
    }),
  );
  const { result, unmount } = renderHook(() => useDashboardLayout());
  unmount();
  await act(async () => {
    reject(new Error('storage error'));
  });
  expect(result.current.loaded).toBe(false);
});
