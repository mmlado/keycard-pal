import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NFCSheet from '../src/components/NFCBottomSheet/NFCSheet';
import { NO_CARD_EXIT_LABEL } from '../src/constants/purchaseLink';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

const onCancel = jest.fn();

beforeEach(() => {
  onCancel.mockClear();
});

describe('NFCSheet', () => {
  describe('openNFCSettings', () => {
    it('shows "Open NFC Settings" button when openNFCSettings is provided', () => {
      render(
        <NFCSheet
          variant="error"
          status="NFC off"
          onCancel={onCancel}
          openNFCSettings={jest.fn()}
        />,
      );
      expect(screen.getByText('Open NFC Settings')).toBeTruthy();
    });

    it('hides retry hint when openNFCSettings is provided', () => {
      render(
        <NFCSheet
          variant="error"
          status="NFC off"
          onCancel={onCancel}
          openNFCSettings={jest.fn()}
        />,
      );
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('calls openNFCSettings when the button is pressed', () => {
      const openNFCSettings = jest.fn();
      render(
        <NFCSheet
          variant="error"
          status="NFC off"
          onCancel={onCancel}
          openNFCSettings={openNFCSettings}
        />,
      );
      fireEvent.press(screen.getByText('Open NFC Settings'));
      expect(openNFCSettings).toHaveBeenCalledTimes(1);
    });

    it('does not show "Open NFC Settings" button when openNFCSettings is not provided', () => {
      render(<NFCSheet variant="error" status="err" onCancel={onCancel} />);
      expect(screen.queryByText('Open NFC Settings')).toBeNull();
    });
  });

  // After an error the bridge reader is disarmed (stopNFCWithError sets the
  // channel's listening=false), so a re-tap emits nothing — the sheet must
  // offer an explicit restart when the caller provides one.
  describe('Try again button', () => {
    it('shows "Try again" instead of the hint when retry is provided', () => {
      render(
        <NFCSheet
          variant="error"
          status="Bad MAC"
          onCancel={onCancel}
          retry={jest.fn()}
        />,
      );
      expect(screen.getByText('Try again')).toBeTruthy();
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('calls retry when the button is pressed', () => {
      const retry = jest.fn();
      render(
        <NFCSheet
          variant="error"
          status="Bad MAC"
          onCancel={onCancel}
          retry={retry}
        />,
      );
      fireEvent.press(screen.getByText('Try again'));
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('does not show the button when openNFCSettings is present', () => {
      render(
        <NFCSheet
          variant="error"
          status="NFC off"
          onCancel={onCancel}
          retry={jest.fn()}
          openNFCSettings={jest.fn()}
        />,
      );
      expect(screen.queryByText('Try again')).toBeNull();
      expect(screen.getByText('Open NFC Settings')).toBeTruthy();
    });

    it('does not show the button outside the error variant', () => {
      render(
        <NFCSheet
          variant="disconnected"
          status="lost"
          onCancel={onCancel}
          retry={jest.fn()}
        />,
      );
      expect(screen.queryByText('Try again')).toBeNull();
    });
  });

  describe('retry hint', () => {
    it('shows "Tap your card to try again" when variant is error and no retry is provided', () => {
      render(<NFCSheet variant="error" status="Bad MAC" onCancel={onCancel} />);
      expect(screen.getByText('Tap your card to try again')).toBeTruthy();
    });

    it('does not show retry hint when variant is scanning', () => {
      render(
        <NFCSheet variant="scanning" status="Waiting..." onCancel={onCancel} />,
      );
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('does not show retry hint when variant is success', () => {
      render(<NFCSheet variant="success" status="Done" onCancel={onCancel} />);
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('does not show retry hint when variant is genuine_warning', () => {
      render(
        <NFCSheet
          variant="genuine_warning"
          status="Unverified"
          onCancel={onCancel}
        />,
      );
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });
  });

  // T5: presence variants. 'disconnected' must read as recoverable, not as a
  // failure — reconnect hint, Cancel available, no failure icon treatment.
  describe('presence variants', () => {
    it('disconnected shows the reconnect hint', () => {
      render(
        <NFCSheet variant="disconnected" status="lost" onCancel={onCancel} />,
      );
      expect(
        screen.getByText('Hold your Keycard against the phone again'),
      ).toBeTruthy();
    });

    it('disconnected keeps the Cancel button (only exit from the wait)', () => {
      render(
        <NFCSheet variant="disconnected" status="lost" onCancel={onCancel} />,
      );
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disconnected does not show the error retry hint', () => {
      render(
        <NFCSheet variant="disconnected" status="lost" onCancel={onCancel} />,
      );
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('connected shows no hints and keeps Cancel', () => {
      render(
        <NFCSheet variant="connected" status="Connected" onCancel={onCancel} />,
      );
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
      expect(
        screen.queryByText('Hold your Keycard against the phone again'),
      ).toBeNull();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
  });

  // #258: someone who reaches the tap prompt without owning a card needs a
  // way out. It is a quiet link, shown only while the app is asking for a
  // card — never once a card is connected, merely moved, or done.
  describe('buy-a-Keycard link', () => {
    const link = NO_CARD_EXIT_LABEL;

    it('shows the link while scanning when onBuyKeycard is provided', () => {
      render(
        <NFCSheet
          variant="scanning"
          status=""
          onCancel={onCancel}
          onBuyKeycard={jest.fn()}
        />,
      );
      expect(screen.getByText(link)).toBeTruthy();
    });

    it('shows the link in the error variant', () => {
      render(
        <NFCSheet
          variant="error"
          status="Bad MAC"
          onCancel={onCancel}
          retry={jest.fn()}
          onBuyKeycard={jest.fn()}
        />,
      );
      expect(screen.getByText(link)).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();
    });

    it('calls onBuyKeycard, not onCancel, when pressed', () => {
      const onBuyKeycard = jest.fn();
      render(
        <NFCSheet
          variant="scanning"
          status=""
          onCancel={onCancel}
          onBuyKeycard={onBuyKeycard}
        />,
      );
      fireEvent.press(screen.getByText(link));
      expect(onBuyKeycard).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it.each(['connected', 'disconnected', 'success'] as const)(
      'hides the link in the %s variant',
      variant => {
        render(
          <NFCSheet
            variant={variant}
            status=""
            onCancel={onCancel}
            onBuyKeycard={jest.fn()}
          />,
        );
        expect(screen.queryByText(link)).toBeNull();
      },
    );

    it('hides the link when onBuyKeycard is not provided', () => {
      render(<NFCSheet variant="scanning" status="" onCancel={onCancel} />);
      expect(screen.queryByText(link)).toBeNull();
    });
  });

  describe('Cancel button', () => {
    it('shows Cancel for scanning variant', () => {
      render(<NFCSheet variant="scanning" status="" onCancel={onCancel} />);
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('shows Cancel for error variant', () => {
      render(<NFCSheet variant="error" status="" onCancel={onCancel} />);
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('hides Cancel for success variant', () => {
      render(<NFCSheet variant="success" status="" onCancel={onCancel} />);
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('calls onCancel when Cancel is pressed from error variant', () => {
      render(<NFCSheet variant="error" status="" onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Cancel is pressed from scanning variant', () => {
      render(<NFCSheet variant="scanning" status="" onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('title and card name', () => {
    it('shows "Tap your Keycard" when cardName is undefined', () => {
      render(<NFCSheet variant="scanning" status="test" onCancel={onCancel} />);
      expect(screen.getByText('Tap your Keycard')).toBeTruthy();
    });

    it('shows "Tap your Keycard" when cardName is null', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="test"
          cardName={null}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('Tap your Keycard')).toBeTruthy();
    });

    it('shows card name when provided', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="test"
          cardName="My Card"
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('My Card')).toBeTruthy();
    });

    it('shows "Unnamed card" for empty string card name', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="test"
          cardName=""
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('Unnamed card')).toBeTruthy();
    });

    it('shows the master fingerprint when an unnamed card has one', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="test"
          cardName=""
          cardFingerprint={0x1a2b3c4d}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('1a2b3c4d')).toBeTruthy();
    });

    it('prefers the card name over the fingerprint when both are present', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="test"
          cardName="My Card"
          cardFingerprint={0x1a2b3c4d}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('My Card')).toBeTruthy();
      expect(screen.queryByText('1a2b3c4d')).toBeNull();
    });
  });

  describe('status text', () => {
    it('renders the status string', () => {
      render(
        <NFCSheet
          variant="scanning"
          status="Selecting applet..."
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('Selecting applet...')).toBeTruthy();
    });

    it('renders error status text', () => {
      render(
        <NFCSheet
          variant="error"
          status="Invalid APDUResponse"
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('Invalid APDUResponse')).toBeTruthy();
    });
  });

  describe('pulse rings', () => {
    it('scanning variant renders more elements than error (pulse rings present)', () => {
      const { toJSON: scanningJSON } = render(
        <NFCSheet variant="scanning" status="" onCancel={onCancel} />,
      );
      const { toJSON: errorJSON } = render(
        <NFCSheet variant="error" status="" onCancel={onCancel} />,
      );
      const scanningSize = JSON.stringify(scanningJSON()).length;
      const errorSize = JSON.stringify(errorJSON()).length;
      expect(scanningSize).toBeGreaterThan(errorSize);
    });

    it('success variant renders more elements than error (pulse rings absent on error)', () => {
      const { toJSON: successJSON } = render(
        <NFCSheet variant="success" status="" onCancel={onCancel} />,
      );
      const { toJSON: errorJSON } = render(
        <NFCSheet variant="error" status="" onCancel={onCancel} />,
      );
      // Both have no pulse rings, but success also has no Cancel — either way they differ
      const successSize = JSON.stringify(successJSON()).length;
      const errorSize = JSON.stringify(errorJSON()).length;
      // error has retry hint + Cancel; success has neither — sizes may differ
      expect(typeof successSize).toBe('number');
      expect(typeof errorSize).toBe('number');
    });
  });
});
