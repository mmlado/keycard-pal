import React from 'react';
import { render, screen } from '@testing-library/react-native';

import UrlQRScreen from '../src/screens/UrlQRScreen';
import {
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/purchaseLink';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: (...args: any[]) => mockSetString(...args) },
}));

jest.mock('../src/components/PrimaryButton', () => jest.fn(() => null));
import PrimaryButton from '../src/components/PrimaryButton';
const MockPrimaryButton = PrimaryButton as jest.MockedFunction<
  typeof PrimaryButton
>;

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockSetOptions = jest.fn();

function renderScreen(params: { url: string; title?: string; note?: string }) {
  const navigation = { setOptions: mockSetOptions } as any;
  const route = { key: 'UrlQR-1', name: 'UrlQR', params } as any;
  return render(<UrlQRScreen navigation={navigation} route={route} />);
}

// The purchase constants are a build-time seam, so the URL and label below are
// whichever twin this project resolves, not a fixed pair. Nothing here asserts
// on their contents: the screen is platform-neutral and renders what it is
// handed, and pinning the copy would only restate purchaseLink's own tests.
describe('UrlQRScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the URL under the QR code', () => {
    renderScreen({ url: KEYCARD_PURCHASE_URL });

    expect(screen.getByText(KEYCARD_PURCHASE_URL)).toBeTruthy();
  });

  it('sets the header title when one is given', () => {
    renderScreen({ url: KEYCARD_PURCHASE_URL, title: BUY_KEYCARD_LABEL });

    expect(mockSetOptions).toHaveBeenCalledWith({ title: BUY_KEYCARD_LABEL });
  });

  it('leaves the header alone when no title is given', () => {
    renderScreen({ url: KEYCARD_PURCHASE_URL });

    expect(mockSetOptions).not.toHaveBeenCalled();
  });

  it('copies the URL when the button is pressed', () => {
    renderScreen({ url: KEYCARD_PURCHASE_URL });

    MockPrimaryButton.mock.calls[0][0].onPress();

    expect(mockSetString).toHaveBeenCalledWith(KEYCARD_PURCHASE_URL);
  });

  describe('the route note', () => {
    // This screen is the whole commercial surface in the offline build: the
    // buy link routes here instead of the browser, so a disclosure can only
    // reach the user through the route params. The screen itself never reaches
    // for the copy, which is why a literal stands in below rather than an
    // import: the disclosure strings exist on one arm of the seam only, and
    // the note plumbing has to hold on both.
    it('renders the note when the route carries one', () => {
      renderScreen({
        url: KEYCARD_PURCHASE_URL,
        title: BUY_KEYCARD_LABEL,
        note: 'A note carried by the route.',
      });

      expect(screen.getByTestId('url-qr-note')).toBeTruthy();
      expect(screen.getByText('A note carried by the route.')).toBeTruthy();
    });

    // Not just the no-disclosure links: iOS exports PURCHASE_QR_NOTE as
    // undefined, so every buy link on that build arrives here noteless and the
    // screen has to stay silent instead of leaving an empty line under the QR.
    it('renders nothing when the route carries no note', () => {
      renderScreen({ url: 'https://github.com/mmlado/keycard-pal' });

      expect(screen.queryByTestId('url-qr-note')).toBeNull();
    });
  });
});
