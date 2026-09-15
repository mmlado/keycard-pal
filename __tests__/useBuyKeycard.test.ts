import { Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useBuyKeycard } from '../src/hooks/useBuyKeycard';
import {
  AFFILIATE_DISCLOSURE,
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/keycard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockConnected = true;
jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
let mockNavReady = true;
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => mockNavReady,
    navigate: (...args: any[]) => mockNavigate(...args),
  },
}));

const PURCHASE_URL = KEYCARD_PURCHASE_URL;

describe('useBuyKeycard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockConnected = true;
    mockNavReady = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the affiliate link in the browser when the phone has a network', async () => {
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(Linking.openURL).toHaveBeenCalledWith(PURCHASE_URL);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.opensInBrowser).toBe(true);
  });

  it('shows the link as a QR code instead when there is no network', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: PURCHASE_URL,
      title: BUY_KEYCARD_LABEL,
      note: AFFILIATE_DISCLOSURE,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(result.current.opensInBrowser).toBe(false);
  });

  it('does nothing when the navigator is not ready yet', async () => {
    mockConnected = false;
    mockNavReady = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('returns a stable callback across renders', () => {
    const { result, rerender } = renderHook(() => useBuyKeycard());
    const first = result.current.buyKeycard;

    rerender({});

    expect(result.current.buyKeycard).toBe(first);
  });
});
