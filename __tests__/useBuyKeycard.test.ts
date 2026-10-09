import { Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useBuyKeycard } from '../src/hooks/useBuyKeycard';
import {
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/purchaseLink';

// This file runs in the 'ios' Jest project, where the bare specifier above
// resolves to `purchaseLink.ios.ts`, so the constants below are the iOS ones
// and the affiliate URL is not reachable from here at all. The Android arm,
// where the same hook opens the affiliate link and the QR screen carries the
// Advertisement note, lives under __tests__/android/. Do not try to reach it
// by pinning Platform.OS: resolution decides which file the hook imported, and
// that happened before any test ran.

// The literals the iOS build must never contain. They are spelled out rather
// than imported because importing them here would resolve to the .ios twin,
// which does not have them, and the assertion would pass for the wrong reason.
const AFFILIATE_HOST = 'get.keycard.tech';
const REFERRAL_CODE = 'vuxxnf';

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

function resetMocks() {
  mockNavigate.mockClear();
  mockConnected = true;
  mockNavReady = true;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  (Linking.openURL as jest.Mock).mockClear();
}

describe('useBuyKeycard', () => {
  beforeEach(resetMocks);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the product site in the browser when the phone has a network', async () => {
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(Linking.openURL).toHaveBeenCalledWith(KEYCARD_PURCHASE_URL);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.opensInBrowser).toBe(true);
  });

  // The URL handed to the browser is the property that decides whether this
  // build is a paid placement, so it is checked as text and not only against
  // the constant: a constant that regressed to the affiliate link would
  // satisfy the equality above and still ship a commission-bearing tap.
  it('hands the browser a URL carrying no shop host and no referral code', async () => {
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    const [opened] = (Linking.openURL as jest.Mock).mock.calls[0];

    expect(opened).toBe('https://keycard.tech');
    expect(opened).not.toContain(AFFILIATE_HOST);
    expect(opened).not.toContain(REFERRAL_CODE);
  });

  // Offline the QR screen is the whole placement, which is why the route
  // carries its own title. `note` stays undefined because there is no
  // commission on this build and so nothing to disclose; a note here would be
  // a claim about commercial status, which the iOS build makes in neither
  // direction.
  it('shows the product site as a QR code with no note', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: KEYCARD_PURCHASE_URL,
      title: BUY_KEYCARD_LABEL,
      note: undefined,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(result.current.opensInBrowser).toBe(false);
  });

  // Same reasoning as the browser case: the QR encodes a URL somebody scans on
  // another device, so it is a placement of its own and gets the same check.
  it('encodes a QR URL carrying no shop host and no referral code', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    const [, params] = mockNavigate.mock.calls[0];

    expect(params.url).toBe('https://keycard.tech');
    expect(params.url).not.toContain(AFFILIATE_HOST);
    expect(params.url).not.toContain(REFERRAL_CODE);
    expect(params.title).not.toContain(AFFILIATE_HOST);
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
