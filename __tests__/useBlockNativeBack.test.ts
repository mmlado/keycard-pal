import { renderHook } from '@testing-library/react-native';

const mockSetPreventRemove = jest.fn();
const mockNotifyPreventRemove = jest.fn();
jest.mock('@react-navigation/native', () => ({
  usePreventRemoveContext: () => ({
    setPreventRemove: mockSetPreventRemove,
    notifyPreventRemove: mockNotifyPreventRemove,
  }),
  useRoute: () => ({ key: 'route-1' }),
}));

jest.unmock('../src/navigation/useBlockNativeBack');

import { useBlockNativeBack } from '../src/navigation/useBlockNativeBack';

describe('useBlockNativeBack', () => {
  beforeEach(() => {
    mockSetPreventRemove.mockClear();
    mockNotifyPreventRemove.mockClear();
  });

  it('marks the route as prevented while blocking, so iOS cancels its own dismissal', () => {
    const view = renderHook(
      ({ block }: { block: boolean }) => useBlockNativeBack(block),
      {
        initialProps: { block: false },
      },
    );
    expect(mockSetPreventRemove).toHaveBeenLastCalledWith(
      expect.any(String),
      'route-1',
      false,
    );

    view.rerender({ block: true });
    expect(mockSetPreventRemove).toHaveBeenLastCalledWith(
      expect.any(String),
      'route-1',
      true,
    );
    expect(mockNotifyPreventRemove).toHaveBeenCalled();
  });

  it('clears the mark on unmount', () => {
    const view = renderHook(() => useBlockNativeBack(true));
    view.unmount();
    expect(mockSetPreventRemove).toHaveBeenLastCalledWith(
      expect.any(String),
      'route-1',
      false,
    );
  });

  it('keeps one id across renders', () => {
    const view = renderHook(
      ({ block }: { block: boolean }) => useBlockNativeBack(block),
      {
        initialProps: { block: true },
      },
    );
    view.rerender({ block: false });
    const ids = new Set(mockSetPreventRemove.mock.calls.map(([id]) => id));
    expect(ids.size).toBe(1);
  });
});
