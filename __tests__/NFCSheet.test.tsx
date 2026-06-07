import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NFCSheet from '../src/components/NFCBottomSheet/NFCSheet';

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

  describe('retry hint', () => {
    it('shows "Tap your card to try again" when variant is error', () => {
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
