import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeycardPurchaseCard from '../src/components/KeycardPurchaseCard';
import { BUY_KEYCARD_LABEL } from '../src/constants/purchaseLink';

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

// This file is the iOS arm. `purchaseLink` resolves to the .ios twin here and
// <AffiliateDisclosure /> to the one that renders nothing, so the card under
// test is the build that earns no commission. Resolution decides that, not
// Platform.OS, which is why nothing is pinned: pinning 'android' would move
// Platform.OS and leave the imports exactly where they are, producing a card
// that exists in no build. The affiliate arm is asserted under
// __tests__/android/ instead, where resolution picks the base files.
describe('KeycardPurchaseCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpensInBrowser = true;
  });

  // Nothing is paid for this pointer, so there is nothing to disclose, and a
  // disclosure that appeared anyway would be a false statement of commercial
  // status rather than a harmless extra. The sweep is over the whole tree
  // because the label is drawn by a child the card renders unconditionally.
  it('shows the card with no advertisement label', () => {
    render(<KeycardPurchaseCard />);

    expect(screen.getByText('Keycard required')).toBeTruthy();
    expect(screen.queryByTestId('affiliate-disclosure')).toBeNull();
    expect(
      screen.queryAllByText(/advertisement|affiliate|commission/i),
    ).toHaveLength(0);
  });

  // The literal is checked beside the constant on purpose: both the component
  // and this test read the same export, so the constant alone would agree with
  // any value the twin happened to carry. The label names the destination and
  // stops there, with no imperative verb and no price.
  it('states where cards come from rather than inviting a purchase', () => {
    render(<KeycardPurchaseCard />);

    expect(screen.getByText('Keycard required')).toBeTruthy();
    expect(MockPrimaryButton.mock.calls[0][0].label).toBe(BUY_KEYCARD_LABEL);
    expect(BUY_KEYCARD_LABEL).toBe('keycard.tech');
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
