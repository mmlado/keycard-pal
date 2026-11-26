import { AppState } from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { useScanDisplay } from '../src/hooks/useScanDisplay';

const mockRaise = jest.fn();
const mockRestore = jest.fn();
jest.mock('../src/utils/scanDisplay', () => ({
  raiseScanDisplay: () => mockRaise(),
  restoreScanDisplay: () => mockRestore(),
}));

describe('useScanDisplay', () => {
  let appStateChanged: () => void;
  let focused: boolean;
  const listeners: Record<string, () => void> = {};
  const off = { focus: jest.fn(), blur: jest.fn() };
  const remove = jest.fn();
  const navigation = {
    isFocused: () => focused,
    addListener: (event: 'focus' | 'blur', listener: () => void) => {
      listeners[event] = listener;
      return off[event];
    },
  };

  const setAppState = (state: typeof AppState.currentState) => {
    AppState.currentState = state;
    appStateChanged();
  };
  const setFocused = (value: boolean) => {
    focused = value;
    listeners[value ? 'focus' : 'blur']();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    focused = true;
    AppState.currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      appStateChanged = fn as () => void;
      return { remove } as any;
    });
  });

  it('raises the display on mount and restores it on unmount', () => {
    const { unmount } = renderHook(() => useScanDisplay(navigation, true));
    expect(mockRaise).toHaveBeenCalledTimes(1);
    expect(mockRestore).not.toHaveBeenCalled();

    unmount();
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalled();
    expect(off.focus).toHaveBeenCalled();
    expect(off.blur).toHaveBeenCalled();
  });

  it('restores while the app is away and raises again on return', () => {
    renderHook(() => useScanDisplay(navigation, true));

    setAppState('inactive');
    expect(mockRestore).toHaveBeenCalledTimes(1);

    setAppState('active');
    expect(mockRaise).toHaveBeenCalledTimes(2);
  });

  it('restores under a screen pushed above and raises again on return', () => {
    renderHook(() => useScanDisplay(navigation, true));

    setFocused(false);
    expect(mockRestore).toHaveBeenCalledTimes(1);

    setFocused(true);
    expect(mockRaise).toHaveBeenCalledTimes(2);
  });

  it('stays restored when the app returns under another screen', () => {
    renderHook(() => useScanDisplay(navigation, true));
    setFocused(false);
    mockRaise.mockClear();

    setAppState('background');
    setAppState('active');
    expect(mockRaise).not.toHaveBeenCalled();
  });

  it('does not raise when mounted in the background', () => {
    AppState.currentState = 'background';
    renderHook(() => useScanDisplay(navigation, true));
    expect(mockRaise).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { unmount } = renderHook(() => useScanDisplay(navigation, false));
    unmount();
    expect(mockRaise).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
