import React, { act } from 'react';
import { render } from '@testing-library/react-native';

import NFCBottomSheet from '../src/components/NFCBottomSheet';
import KeycardScreen from '../src/screens/KeycardScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/utils/ethSignature', () => ({
  buildEthSignatureUR: jest.fn(),
}));

jest.mock('../src/utils/cryptoAccount', () => ({
  buildCryptoAccountUR: jest.fn(),
  pubKeyFingerprint: jest.fn(),
}));

jest.mock('../src/utils/cryptoHdKey', () => ({
  buildCryptoHdKeyUR: jest.fn(),
}));

jest.mock('../src/utils/cryptoMultiAccounts', () => ({
  buildCryptoMultiAccountsUR: jest.fn(() => 'ur:crypto-multi-accounts/mock'),
  exportKeysForBitget: jest.fn(),
}));

jest.mock('../src/utils/btcPsbt', () => ({
  BtcSigningSession: jest.fn().mockImplementation(() => ({
    signWithKeycard: jest.fn().mockResolvedValue({ psbtHex: 'deadbeef' }),
  })),
  buildCryptoPsbtUR: jest.fn(() => 'ur:crypto-psbt/mock'),
  inspectBtcPsbt: jest.fn(),
}));

jest.mock('../src/utils/btcMessage', () => ({
  buildBtcSignatureUR: jest.fn(() => 'ur:btc-signature/mock'),
  hashBitcoinMessage: jest.fn(() => new Uint8Array(32)),
  inspectBtcSignRequest: jest.fn(() => ({
    message: 'hello btc',
    isUtf8: true,
  })),
  parseBtcSignRequest: jest.fn(),
  parseKeycardBtcMessageSignature: jest.fn(() => ({
    signature: Buffer.alloc(65, 0x11),
    publicKey: Buffer.alloc(33, 0x02),
  })),
}));

const mockSubmitPin = jest.fn();
const mockCancel = jest.fn();
const mockExecute = jest.fn();
const mockUseKeycardOperation = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOperation: () => mockUseKeycardOperation(),
}));

const navigation = {
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;

const signRoute = {
  params: {
    operation: 'sign',
    signMode: 'eth',
    signData: 'deadbeef',
    derivationPath: "m/44'/60'/0'/0",
    dataType: 2,
    chainId: 1,
    requestId: undefined,
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

const btcSignRoute = {
  params: {
    operation: 'sign',
    signMode: 'btc',
    psbtHex: 'deadbeef',
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

const btcMessageSignRoute = {
  params: {
    operation: 'sign',
    signMode: 'btc-message',
    requestId: '00112233445566778899aabbccddeeff',
    signDataHex: Buffer.from('hello btc', 'utf8').toString('hex'),
    derivationPath: "m/84'/0'/0'/0/3",
    address: 'bc1qexampleaddress',
    origin: 'Sparrow',
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

const btcExportRoute = {
  params: {
    operation: 'export_key',
    derivationPath: "m/84'/0'/0'",
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

const ethExportRoute = {
  params: {
    operation: 'export_key',
    derivationPath: "m/44'/60'/0'",
    source: 'account.standard',
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

const bitgetExportRoute = {
  params: {
    operation: 'export_key',
    derivationPath: 'bitget',
  },
  key: 'Keycard',
  name: 'Keycard',
} as any;

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    execute: mockExecute,
    submitPin: mockSubmitPin,
    cancel: mockCancel,
    reset: jest.fn(),
  };
}

async function renderScreen(phase: string, route = signRoute) {
  mockUseKeycardOperation.mockReturnValue(hookMock(phase));
  const view = render(<KeycardScreen route={route} navigation={navigation} />);
  await act(async () => {});
  return view;
}

async function renderWithMockedHook(route = signRoute) {
  const view = render(<KeycardScreen route={route} navigation={navigation} />);
  await act(async () => {});
  return view;
}

describe('KeycardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('phase-based rendering', () => {
    it('sets header title to "Enter Keycard PIN"', async () => {
      await renderScreen('pin_entry');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Enter Keycard PIN',
      });
    });

    it('nfc.phase is pin_entry when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      const calls = MockNFCBottomSheet.mock.calls;
      const props = calls[calls.length - 1][0];
      expect(props.nfc.phase).toBe('pin_entry');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      await renderScreen('nfc');
      const calls = MockNFCBottomSheet.mock.calls;
      const props = calls[calls.length - 1][0];
      expect(props.nfc.phase).toBe('nfc');
    });

    it('nfc.phase is idle when phase is idle', async () => {
      await renderScreen('idle');
      const calls = MockNFCBottomSheet.mock.calls;
      const props = calls[calls.length - 1][0];
      expect(props.nfc.phase).toBe('idle');
    });
  });

  describe('on mount', () => {
    it('calls execute for a sign operation', async () => {
      await renderScreen('pin_entry');
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('NFCBottomSheet variant prop', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is nfc when phase is nfc', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      await renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });

    it('nfc.phase is done and showOnDone is true when phase is done', async () => {
      await renderScreen('done');
      expect(lastProps().nfc.phase).toBe('done');
      expect(lastProps().showOnDone).toBe(true);
    });

    it('nfc.phase is pin_entry when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      expect(lastProps().nfc.phase).toBe('pin_entry');
    });
  });

  describe('navigation delay after done', () => {
    it('does not navigate immediately when phase becomes done', async () => {
      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: new Uint8Array([1, 2, 3]),
      });
      await renderWithMockedHook(signRoute);
      expect(navigation.reset).not.toHaveBeenCalled();
    });

    it('navigates after the 800ms timer fires', async () => {
      const { buildEthSignatureUR } = require('../src/utils/ethSignature') as {
        buildEthSignatureUR: jest.Mock;
      };
      buildEthSignatureUR.mockReturnValue('UR:ETH-SIGN/...');

      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: new Uint8Array([1, 2, 3]),
      });
      await renderWithMockedHook(signRoute);
      expect(navigation.reset).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      expect(navigation.reset).toHaveBeenCalledTimes(1);
    });

    it('uses crypto-account URs for bitcoin wallet export', async () => {
      const { buildCryptoAccountUR } =
        require('../src/utils/cryptoAccount') as {
          buildCryptoAccountUR: jest.Mock;
        };
      buildCryptoAccountUR.mockReturnValue('UR:CRYPTO-ACCOUNT/...');

      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: { masterFingerprint: 1, descriptors: [] },
      });
      await renderWithMockedHook(btcExportRoute);
      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      expect(buildCryptoAccountUR).toHaveBeenCalledWith({
        masterFingerprint: 1,
        descriptors: [],
      });
      expect(navigation.reset).toHaveBeenCalledTimes(1);
    });

    it('uses crypto-hdkey URs for ethereum wallet export with fingerprinted export result', async () => {
      const { buildCryptoHdKeyUR } = require('../src/utils/cryptoHdKey') as {
        buildCryptoHdKeyUR: jest.Mock;
      };
      buildCryptoHdKeyUR.mockReturnValue('UR:CRYPTO-HDKEY/...');

      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: {
          exportRespData: new Uint8Array([1, 2, 3]),
          sourceFingerprint: 0xdeadbeef,
          parentFingerprint: 0xaabbccdd,
        },
      });
      await renderWithMockedHook(ethExportRoute);
      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      expect(buildCryptoHdKeyUR).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        "m/44'/60'/0'",
        0xdeadbeef,
        0xaabbccdd,
        'account.standard',
      );
      expect(navigation.reset).toHaveBeenCalledTimes(1);
    });
  });

  describe('PIN pad input', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.submitPin is the submitPin function when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      expect(lastProps().nfc.submitPin).toBe(mockSubmitPin);
    });

    it('nfc.submitPin is available when phase is pin_entry', async () => {
      await renderScreen('pin_entry');
      expect(typeof lastProps().nfc.submitPin).toBe('function');
    });
  });

  describe('Bitget export navigation', () => {
    it('navigates to QRResult after Bitget export completes', async () => {
      const { buildCryptoMultiAccountsUR } =
        require('../src/utils/cryptoMultiAccounts') as {
          buildCryptoMultiAccountsUR: jest.Mock;
        };
      buildCryptoMultiAccountsUR.mockReturnValue(
        'ur:crypto-multi-accounts/mock',
      );

      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: { masterFingerprint: 1, keys: [] },
      });
      await renderWithMockedHook(bitgetExportRoute);
      expect(navigation.reset).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      expect(navigation.reset).toHaveBeenCalledTimes(1);
      const resetCall = navigation.reset.mock.calls[0][0];
      expect(resetCall.routes[2].name).toBe('QRResult');
      expect(resetCall.routes[2].params.urString).toBe(
        'ur:crypto-multi-accounts/mock',
      );
    });
  });

  describe('BTC sign navigation', () => {
    it('calls execute for a btc sign operation', async () => {
      await renderScreen('pin_entry', btcSignRoute);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('navigates to QRResult after btc sign completes', async () => {
      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: { psbtHex: '70736274ff01000a0200000000000000000000' },
      });
      await renderWithMockedHook(btcSignRoute);
      expect(navigation.reset).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      expect(navigation.reset).toHaveBeenCalledTimes(1);
      const resetCall = navigation.reset.mock.calls[0][0];
      expect(resetCall.routes[1].name).toBe('QRResult');
      expect(resetCall.routes[1].params.urString).toMatch(/^ur:crypto-psbt\//i);
    });

    it('does not navigate if result is missing psbtHex', async () => {
      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: { psbtHex: undefined },
      });
      await renderWithMockedHook(btcSignRoute);
      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      expect(navigation.reset).not.toHaveBeenCalled();
    });
  });

  describe('BTC message sign navigation', () => {
    it('signs the legacy Bitcoin message hash with the requested path', async () => {
      const { hashBitcoinMessage } = require('../src/utils/btcMessage') as {
        hashBitcoinMessage: jest.Mock;
      };
      const hash = new Uint8Array(32).fill(0xab);
      hashBitcoinMessage.mockReturnValue(hash);
      const checkOK = jest.fn();
      const signWithPath = jest.fn().mockResolvedValue({
        checkOK,
        data: new Uint8Array([1, 2, 3]),
      });

      await renderScreen('pin_entry', btcMessageSignRoute);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const signOperation = mockExecute.mock.calls[0][0];
      const result = await signOperation({ signWithPath });

      expect(hashBitcoinMessage).toHaveBeenCalledWith(
        btcMessageSignRoute.params.signDataHex,
      );
      expect(signWithPath).toHaveBeenCalledWith(
        hash,
        btcMessageSignRoute.params.derivationPath,
        false,
      );
      expect(checkOK).toHaveBeenCalledTimes(1);
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('navigates to QRResult after btc message sign completes', async () => {
      mockUseKeycardOperation.mockReturnValue({
        ...hookMock('done'),
        result: new Uint8Array([1, 2, 3]),
      });
      await renderWithMockedHook(btcMessageSignRoute);
      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      expect(navigation.reset).toHaveBeenCalledTimes(1);
      const resetCall = navigation.reset.mock.calls[0][0];
      expect(resetCall.routes[1].name).toBe('QRResult');
      expect(resetCall.routes[1].params.urString).toBe('ur:btc-signature/mock');
    });
  });
});
