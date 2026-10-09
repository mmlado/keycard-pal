import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AddressListScreen from '../src/screens/address/AddressListScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

// Mock @scure/bip32 — we don't need real BIP32 derivation here
jest.mock('@scure/bip32', () => ({ HDKey: jest.fn() }));

// Mock deriveAddresses — returns predictable test addresses
const mockDeriveAddresses = jest.fn();
jest.mock('../src/utils/hdAddress', () => ({
  ...jest.requireActual('../src/utils/hdAddress'),
  parseExtendedKeyFromTLV: jest.fn(),
  deriveAddresses: (...args: any[]) => mockDeriveAddresses(...args),
}));

// Mock the NFC layer beneath useAddressEnumeration — the enumeration hook
// itself runs for real, so batching and path pairing are covered here.
const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockSubmitPin = jest.fn();
const mockUseAddresses = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: () => mockUseAddresses(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
} as any;

function makeRoute(coin: 'eth' | 'btc' = 'eth') {
  return { key: 'AddressList', name: 'AddressList', params: { coin } } as any;
}

const mockExternalChain = {};
const mockAccountKey = {
  deriveChild: jest.fn().mockReturnValue(mockExternalChain),
};

function hookMock(phase: string, result: any = null) {
  return {
    phase,
    status: `status-${phase}`,
    result,
    start: mockStart,
    cancel: mockCancel,
    submitPin: mockSubmitPin,
  };
}

function makeBatch(prefix: string, count = 20): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`);
}

async function renderScreen(
  phase = 'idle',
  result: any = null,
  coin: 'eth' | 'btc' = 'eth',
) {
  mockUseAddresses.mockReturnValue(hookMock(phase, result));
  const view = render(
    <AddressListScreen navigation={navigation} route={makeRoute(coin)} />,
  );
  await act(async () => {
    jest.runAllTimers();
  });
  return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressListScreen', () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    mockSubmitPin.mockClear();
    MockNFCBottomSheet.mockClear();
    mockDeriveAddresses.mockClear();
    mockAccountKey.deriveChild.mockClear();
    navigation.goBack.mockClear();
    navigation.navigate.mockClear();
    navigation.setOptions.mockClear();
  });

  describe('on mount', () => {
    it('calls start() immediately', async () => {
      await renderScreen();
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('NFCBottomSheet visibility', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is idle when phase is idle', async () => {
      await renderScreen('idle');
      expect(lastProps().nfc.phase).toBe('idle');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      await renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });

    it('nfc.phase is done when phase is done', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);
      expect(lastProps().nfc.phase).toBe('done');
    });

    it('passes the status string to NFCBottomSheet via nfc.status', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.status).toBe('status-nfc');
    });
  });

  describe('pin_entry phase', () => {
    it('nfc.phase is pin_entry when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      const calls = MockNFCBottomSheet.mock.calls;
      const props = calls[calls.length - 1][0];
      expect(props.nfc.phase).toBe('pin_entry');
    });

    it('nfc.submitPin is available when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      const calls = MockNFCBottomSheet.mock.calls;
      const props = calls[calls.length - 1][0];
      expect(props.nfc.submitPin).toBe(mockSubmitPin);
    });
  });

  describe('cancel', () => {
    it('calls cancel() and navigation.goBack() when NFCBottomSheet cancel fires', async () => {
      await renderScreen('nfc');
      const onCancel = MockNFCBottomSheet.mock.calls[0][0].onCancel;
      await act(async () => {
        onCancel();
      });
      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('address list', () => {
    it('calls deriveAddresses when phase becomes done', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);
      expect(mockDeriveAddresses).toHaveBeenCalledWith(
        mockExternalChain,
        20,
        expect.any(Function),
        0,
      );
    });

    it('renders the first batch of addresses', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);
      expect(screen.getByText('0xAddr0')).toBeTruthy();
      expect(screen.getByText('0xAddr9')).toBeTruthy();
    });

    it('renders the full derivation path under each address', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);
      expect(screen.getByText("m/44'/60'/0'/0/0")).toBeTruthy();
      expect(screen.getByText("m/44'/60'/0'/0/9")).toBeTruthy();
    });

    it('loads more addresses starting at the next index on subsequent calls', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);

      const flatList = screen.UNSAFE_getByType(FlatList);
      await act(async () => {
        flatList.props.onEndReached();
      });
      await act(async () => {
        jest.runAllTimers();
      });

      expect(mockDeriveAddresses).toHaveBeenCalledTimes(2);
      expect(mockDeriveAddresses).toHaveBeenNthCalledWith(
        2,
        mockExternalChain,
        20,
        expect.any(Function),
        20,
      );
    });
  });

  describe('row press', () => {
    it('navigates to AddressDetail with address and derivation path when a row is pressed', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('0xAddr'));
      await renderScreen('done', mockAccountKey);

      await act(async () => {
        fireEvent.press(screen.getByText('0xAddr0'));
      });

      expect(navigation.navigate).toHaveBeenCalledWith('AddressDetail', {
        address: '0xAddr0',
        derivationPath: "m/44'/60'/0'/0/0",
      });
    });
  });

  describe('Bitcoin coin', () => {
    it('calls deriveAddresses with the btc address function', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('bc1q'));
      await renderScreen('done', mockAccountKey, 'btc');
      expect(mockDeriveAddresses).toHaveBeenCalled();
      expect(screen.getByText('bc1q0')).toBeTruthy();
    });

    it('renders BTC derivation paths', async () => {
      mockDeriveAddresses.mockReturnValue(makeBatch('bc1q'));
      await renderScreen('done', mockAccountKey, 'btc');
      expect(screen.getByText("m/84'/0'/0'/0/0")).toBeTruthy();
    });
  });
});
