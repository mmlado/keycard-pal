import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NFCError from '../src/components/NFCBottomSheet/NFCError';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

const onCancel = jest.fn();
const onRetry = jest.fn();

beforeEach(() => {
  onCancel.mockClear();
  onRetry.mockClear();
});

describe('NFCError', () => {
  describe('content', () => {
    it('shows "Something went wrong" title', () => {
      render(<NFCError status="bad" onCancel={onCancel} />);
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('renders the status message', () => {
      render(<NFCError status="Invalid APDUResponse" onCancel={onCancel} />);
      expect(screen.getByText('Invalid APDUResponse')).toBeTruthy();
    });

    it('renders a different status message', () => {
      render(
        <NFCError status="Connection lost — tap again" onCancel={onCancel} />,
      );
      expect(screen.getByText('Connection lost — tap again')).toBeTruthy();
    });
  });

  describe('Cancel button', () => {
    it('shows Cancel button', () => {
      render(<NFCError status="err" onCancel={onCancel} />);
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('calls onCancel when Cancel is pressed', () => {
      render(<NFCError status="err" onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call retry when Cancel is pressed', () => {
      render(<NFCError status="err" retry={onRetry} onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Cancel'));
      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe('openNFCSettings button', () => {
    it('shows "Open NFC Settings" button when openNFCSettings is provided', () => {
      render(
        <NFCError
          status="NFC off"
          openNFCSettings={jest.fn()}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText('Open NFC Settings')).toBeTruthy();
    });

    it('hides "Try again" when openNFCSettings is provided (even with retry)', () => {
      render(
        <NFCError
          status="NFC off"
          openNFCSettings={jest.fn()}
          retry={onRetry}
          onCancel={onCancel}
        />,
      );
      expect(screen.queryByText('Try again')).toBeNull();
    });

    it('calls openNFCSettings when the button is pressed', () => {
      const openNFCSettings = jest.fn();
      render(
        <NFCError
          status="NFC off"
          openNFCSettings={openNFCSettings}
          onCancel={onCancel}
        />,
      );
      fireEvent.press(screen.getByText('Open NFC Settings'));
      expect(openNFCSettings).toHaveBeenCalledTimes(1);
    });

    it('does not show "Open NFC Settings" when prop is not provided', () => {
      render(<NFCError status="err" onCancel={onCancel} />);
      expect(screen.queryByText('Open NFC Settings')).toBeNull();
    });
  });

  describe('retry button', () => {
    it('shows "Try again" button when retry prop is provided', () => {
      render(<NFCError status="err" retry={onRetry} onCancel={onCancel} />);
      expect(screen.getByText('Try again')).toBeTruthy();
    });

    it('hides "Try again" button when retry prop is not provided', () => {
      render(<NFCError status="err" onCancel={onCancel} />);
      expect(screen.queryByText('Try again')).toBeNull();
    });

    it('calls retry when "Try again" is pressed', () => {
      render(<NFCError status="err" retry={onRetry} onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Try again'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when "Try again" is pressed', () => {
      render(<NFCError status="err" retry={onRetry} onCancel={onCancel} />);
      fireEvent.press(screen.getByText('Try again'));
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('paddingBottom', () => {
    it('applies default paddingBottom of 24 when not specified', () => {
      const { toJSON } = render(<NFCError status="err" onCancel={onCancel} />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"paddingBottom":24');
    });

    it('applies custom paddingBottom when specified', () => {
      const { toJSON } = render(
        <NFCError status="err" onCancel={onCancel} paddingBottom={48} />,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"paddingBottom":48');
    });
  });
});
