import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeycardPurchaseCard from '../src/components/KeycardPurchaseCard';
import { AFFILIATE_DISCLOSURE } from '../src/constants/keycard';

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockBuyKeycard = jest.fn();
let mockOpensInBrowser = true;
jest.mock('../src/hooks/useBuyKeycard', () => ({
  useBuyKeycard: () => ({
    buyKeycard: mockBuyKeycard,
    opensInBrowser: mockOpensInBrowser,
  }),
}));

jest.mock('../src/components/PrimaryButton', () => jest.fn(() => null));
import PrimaryButton from '../src/components/PrimaryButton';
const MockPrimaryButton = PrimaryButton as jest.MockedFunction<
  typeof PrimaryButton
>;

describe('KeycardPurchaseCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpensInBrowser = true;
  });

  it('labels the purchase link as an advertisement', () => {
    render(<KeycardPurchaseCard />);

    expect(screen.getByTestId('affiliate-disclosure')).toBeTruthy();
    expect(screen.getByText(AFFILIATE_DISCLOSURE)).toBeTruthy();
  });

  it('buys through the hook rather than opening a URL itself', () => {
    render(<KeycardPurchaseCard />);

    MockPrimaryButton.mock.calls[0][0].onPress();

    expect(mockBuyKeycard).toHaveBeenCalled();
  });

  // The icon tracks connectivity (browser vs QR), but the shared icons mock
  // answers every key with the same component on purpose, so which icon was
  // picked cannot be asserted by identity. Both arms are rendered so neither
  // goes unexercised, and the assertion is limited to what is actually true.
  it.each([
    ['with a network connection', true],
    ['without one (always in the offline build)', false],
  ])('renders the buy button %s', (_label, connected) => {
    mockOpensInBrowser = connected;

    render(<KeycardPurchaseCard />);

    expect(MockPrimaryButton.mock.calls[0][0].icon).toBeDefined();
    expect(MockPrimaryButton.mock.calls[0][0].onPress).toBe(mockBuyKeycard);
  });

  describe('when dismissible', () => {
    it('shows a close button that calls onClose', () => {
      const onClose = jest.fn();
      render(
        <KeycardPurchaseCard onClose={onClose} closeButtonTestID="close" />,
      );

      fireEvent.press(screen.getByTestId('close'));

      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows no close button when not dismissible', () => {
    render(<KeycardPurchaseCard closeButtonTestID="close" />);

    expect(screen.queryByTestId('close')).toBeNull();
  });
});
