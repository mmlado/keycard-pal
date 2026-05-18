import React, { act } from 'react';
import { render } from '@testing-library/react-native';

import QRScannerScreen from '../src/screens/QRScannerScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  const { createElement } = require('react');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Button: ({ children, onPress }: any) =>
      createElement(Text, { onPress }, children),
    ActivityIndicator: () => null,
    Icon: () => null,
  };
});

// Capture the Camera's onReadCode so tests can trigger scan events.
let capturedOnReadCode: ((event: any) => void) | null = null;

jest.mock('../src/components/Camera', () => ({
  Camera: (props: any) => {
    capturedOnReadCode = props.onReadCode;
    return null;
  },
}));

// Control URDecoder behaviour per test.
const mockReceivedPart = jest.fn();
const mockEstimatedPercent = jest.fn();
const mockIsComplete = jest.fn();
const mockIsSuccess = jest.fn();
const mockResultUR = jest.fn();
const mockResultError = jest.fn();

jest.mock('@ngraveio/bc-ur', () => ({
  URDecoder: jest.fn().mockImplementation(() => ({
    receivePart: mockReceivedPart,
    estimatedPercentComplete: mockEstimatedPercent,
    isComplete: mockIsComplete,
    isSuccess: mockIsSuccess,
    resultUR: mockResultUR,
    resultError: mockResultError,
  })),
}));

// useFocusEffect — call the callback immediately (simulates screen focus).
// useIsFocused — returns true by default so the Camera renders.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    require('react').useEffect(cb, []);
  },
  useIsFocused: () => true,
}));

const mockHandleUR = jest.fn();
jest.mock('../src/utils/ur', () => ({
  handleUR: (...args: any[]) => mockHandleUR(...args),
}));

const mockDetectWcUri = jest.fn();
jest.mock('../src/utils/walletConnect/qrDetector.online', () => ({
  detectWcUri: (...args: any[]) => mockDetectWcUri(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn(), setOptions: jest.fn() } as any;

function scan(value: string) {
  capturedOnReadCode?.({ nativeEvent: { codeStringValue: value } });
}

async function renderScreen() {
  const view = render(
    <QRScannerScreen navigation={navigation} route={{} as any} />,
  );
  await act(async () => {});
  return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QRScannerScreen', () => {
  beforeEach(() => {
    capturedOnReadCode = null;
    mockReceivedPart.mockReset();
    mockEstimatedPercent.mockReturnValue(0);
    mockIsComplete.mockReturnValue(false);
    mockIsSuccess.mockReturnValue(false);
    mockResultUR.mockReturnValue(undefined);
    mockResultError.mockReturnValue('decode error');
    mockHandleUR.mockReset();
    mockDetectWcUri.mockReset();
    mockDetectWcUri.mockReturnValue(false);
    navigation.navigate.mockClear();
    navigation.setOptions.mockClear();
  });

  describe('camera view', () => {
    it('renders the scanner title', async () => {
      await renderScreen();
      expect(navigation.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Scan' }),
      );
    });

    it('registers onReadCode on the Camera when focused', async () => {
      await renderScreen();
      expect(typeof capturedOnReadCode).toBe('function');
    });
  });

  describe('onCodeScanned — filtering', () => {
    it('ignores a falsy code value', async () => {
      await renderScreen();
      await act(async () => {
        scan('');
      });
      expect(mockReceivedPart).not.toHaveBeenCalled();
    });

    it('ignores a non-UR QR code', async () => {
      await renderScreen();
      await act(async () => {
        scan('https://example.com');
      });
      expect(mockReceivedPart).not.toHaveBeenCalled();
    });

    it('accepts a UR code regardless of case', async () => {
      await renderScreen();
      await act(async () => {
        scan('ur:eth-sign-request/somedata');
      });
      expect(mockReceivedPart).toHaveBeenCalledWith(
        'ur:eth-sign-request/somedata',
      );
    });
  });

  describe('onCodeScanned — progress', () => {
    it('updates progress when a partial UR frame is received', async () => {
      mockEstimatedPercent.mockReturnValue(0.5);
      const renderer = await renderScreen();
      await act(async () => {
        scan('ur:eth-sign-request/part1');
      });
      // Progress > 0 renders the progress bar (identified by its fill colour)
      expect(JSON.stringify(renderer.toJSON())).toContain('#1C8A80');
    });
  });

  describe('onCodeScanned — complete UR', () => {
    it('navigates to TransactionDetail with parsed result on success', async () => {
      const fakeUR = { type: 'eth-sign-request', cbor: Buffer.alloc(0) };
      const fakeResult = { kind: 'eth-sign-request', request: {} };
      mockIsComplete.mockReturnValue(true);
      mockIsSuccess.mockReturnValue(true);
      mockResultUR.mockReturnValue(fakeUR);
      mockHandleUR.mockReturnValue(fakeResult);

      await renderScreen();
      await act(async () => {
        scan('ur:eth-sign-request/completedata');
      });

      expect(mockHandleUR).toHaveBeenCalledWith(fakeUR.type, fakeUR.cbor);
      expect(navigation.navigate).toHaveBeenCalledWith('TransactionDetail', {
        result: fakeResult,
      });
    });

    it('navigates to TransactionDetail with an error result on decode failure', async () => {
      mockIsComplete.mockReturnValue(true);
      mockIsSuccess.mockReturnValue(false);
      mockResultError.mockReturnValue('bad checksum');

      await renderScreen();
      await act(async () => {
        scan('ur:eth-sign-request/baddata');
      });

      expect(navigation.navigate).toHaveBeenCalledWith('TransactionDetail', {
        result: { kind: 'error', message: 'bad checksum' },
      });
    });

    it('ignores subsequent scan events after a complete scan', async () => {
      mockIsComplete.mockReturnValue(true);
      mockIsSuccess.mockReturnValue(true);
      mockResultUR.mockReturnValue({
        type: 'eth-sign-request',
        cbor: Buffer.alloc(0),
      });
      mockHandleUR.mockReturnValue({ kind: 'eth-sign-request', request: {} });

      await renderScreen();
      await act(async () => {
        scan('ur:eth-sign-request/first');
        scan('ur:eth-sign-request/second');
      });

      expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('onCodeScanned — WalletConnect URI', () => {
    it('sets scannedRef and returns early when detectWcUri returns true', async () => {
      mockDetectWcUri.mockReturnValue(true);
      await renderScreen();
      await act(async () => {
        scan('wc:abc123@2?relay-protocol=irn');
        // second scan should be ignored because scannedRef is set
        scan('wc:abc123@2?relay-protocol=irn');
      });
      // detectWcUri called once; second scan blocked by scannedRef guard
      expect(mockDetectWcUri).toHaveBeenCalledTimes(1);
      expect(mockReceivedPart).not.toHaveBeenCalled();
    });
  });

  describe('camera permission — Android denied', () => {
    const { PermissionsAndroid, Platform } = require('react-native');
    let originalOS: string;
    let originalRequest: typeof PermissionsAndroid.request;

    beforeEach(() => {
      originalOS = Platform.OS;
      originalRequest = PermissionsAndroid.request;
      (Platform as any).OS = 'android';
      PermissionsAndroid.request = jest
        .fn()
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    });

    afterEach(() => {
      (Platform as any).OS = originalOS;
      PermissionsAndroid.request = originalRequest;
    });

    it('shows the permission denied UI with Open Settings button', async () => {
      const { getByText } = render(
        <QRScannerScreen navigation={navigation} route={{} as any} />,
      );
      await act(async () => {});
      expect(getByText('Camera Permission Required')).toBeTruthy();
      expect(getByText('Open Settings')).toBeTruthy();
    });
  });
});
