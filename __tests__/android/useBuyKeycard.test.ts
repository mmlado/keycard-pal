import { Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useBuyKeycard } from '../../src/hooks/useBuyKeycard';
import {
  AFFILIATE_DISCLOSURE,
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../../src/constants/purchaseLink';

// This file runs in the 'android' Jest project, where the bare specifier above
// resolves to `purchaseLink.ts` rather than its `.ios` twin, so the constants
// below are the affiliate ones. That resolution is the only way to reach this
// arm of the hook: the iOS project cannot see these values at all, so without
// this file dropping the affiliate parameter from Android would turn nothing
// red. The iOS expectations live in __tests__/useBuyKeycard.test.ts.

// The literals the Android build must keep. They are spelled out rather than
// derived from the constants because the point of this file is to catch a
// constant that changed: an assertion written only against the import would
// follow the regression and stay green.
const AFFILIATE_URL = 'https://get.keycard.tech/vuxxnf';
const REFERRAL_CODE = 'vuxxnf';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockConnected = true;
jest.mock('../../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
let mockNavReady = true;
jest.mock('../../src/navigation/navigationRef', () => ({
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

describe('useBuyKeycard on Android', () => {
  beforeEach(resetMocks);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the affiliate link in the browser when the phone has a network', async () => {
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(Linking.openURL).toHaveBeenCalledWith(KEYCARD_PURCHASE_URL);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // The referral code is what makes the tap earn a commission, and it is a
  // single query-free path segment somebody could drop while tidying the URL
  // without the equality above noticing. It is checked as text so that the
  // disclosures this build is required to show keep matching what it does.
  it('hands the browser the shop URL with the referral code on it', async () => {
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    const [opened] = (Linking.openURL as jest.Mock).mock.calls[0];

    expect(opened).toBe(AFFILIATE_URL);
    expect(opened).toContain(REFERRAL_CODE);
  });

  // Offline the QR screen is the whole placement, so the disclosure has to
  // travel with the route: there is no surrounding screen to carry it, and the
  // scan happens on a second device where nothing else of this build is
  // visible. `note` is the only place that label can live.
  it('shows the affiliate link as a QR code with the disclosure attached', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: KEYCARD_PURCHASE_URL,
      title: BUY_KEYCARD_LABEL,
      note: AFFILIATE_DISCLOSURE,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  // Same reasoning as the browser case for the URL, plus the note read as text:
  // comparing it to the imported constant alone would also pass if both the
  // note and the constant went away, which is exactly the regression that ships
  // an undisclosed paid placement. "Advertisement" has to lead the wording,
  // since "partnership" and "sponsored" are named as inadequate.
  it('encodes the referral code and labels the QR screen as advertising', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useBuyKeycard());

    await act(() => result.current.buyKeycard());

    const [, params] = mockNavigate.mock.calls[0];

    expect(params.url).toBe(AFFILIATE_URL);
    expect(params.url).toContain(REFERRAL_CODE);
    expect(params.title).toBe('Buy a Keycard');
    expect(typeof params.note).toBe('string');
    expect(params.note.startsWith('Advertisement')).toBe(true);
    expect(params.note).toContain('commission');
  });
});
