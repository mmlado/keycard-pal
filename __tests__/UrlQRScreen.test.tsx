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

function renderScreen(params: { url: string; title?: string }) {
  const navigation = { setOptions: mockSetOptions } as any;
  const route = { key: 'UrlQR-1', name: 'UrlQR', params } as any;
  return render(<UrlQRScreen navigation={navigation} route={route} />);
}

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
});
