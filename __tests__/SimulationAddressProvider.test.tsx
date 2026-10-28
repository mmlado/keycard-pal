import React from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SimulationAddressProvider, {
  useSimulationAddressOp,
} from '../src/components/SignRequestDetail/SimulationAddressProvider';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedOperation:
  | ((cmdSet: any, path: string | undefined) => Promise<string>)
  | null = null;
let capturedOptions: any = null;
const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockOp = {
  phase: 'idle',
  userCancels: 0,
  status: '',
  cardName: null,
  pinError: null,
  result: null,
  start: mockStart,
  cancel: mockCancel,
  submitPin: jest.fn(),
  reset: jest.fn(),
  retry: jest.fn(),
  proceedWithNonGenuine: jest.fn(),
};

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (fn: any, opts: any) => {
    capturedOperation = fn;
    capturedOptions = opts;
    return mockOp;
  },
}));

const mockNavigation = {
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
}));

jest.mock('../src/components/NFCBottomSheet', () => {
  const { View: RNView } = require('react-native');
  return ({ nfc, onCancel }: any) => (
    <RNView testID="nfc-sheet" nfc={nfc} onCancel={onCancel} />
  );
});

const mockPubKeyToEthAddress = jest.fn((_key: Uint8Array) => '0xDerived');
jest.mock('../src/utils/ethereumAddress', () => ({
  pubKeyToEthAddress: (key: Uint8Array) => mockPubKeyToEthAddress(key),
}));

const mockPublicKey = new Uint8Array(33);
jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BIP32KeyPair: {
      extendedKey: () => ({ publicKey: mockPublicKey }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PATH = "m/44'/60'/0'/0";

function Consumer() {
  const op = useSimulationAddressOp();
  return <Text onPress={() => op.start()}>consumer</Text>;
}

function providerTree(derivationPath?: string, title = 'Review transaction') {
  return (
    <View testID="root">
      <SimulationAddressProvider derivationPath={derivationPath} title={title}>
        <Consumer />
      </SimulationAddressProvider>
    </View>
  );
}

function renderProvider({ derivationPath }: { derivationPath?: string }) {
  return render(providerTree(derivationPath));
}

const withPath = { derivationPath: PATH };

beforeEach(() => {
  capturedOperation = null;
  capturedOptions = null;
  mockOp.phase = 'idle';
  mockOp.userCancels = 0;
  mockStart.mockClear();
  mockCancel.mockClear();
  mockNavigation.goBack.mockClear();
  mockNavigation.setOptions.mockClear();
  mockPubKeyToEthAddress.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimulationAddressProvider', () => {
  it('hands the op to its consumers, started with the derivation path', () => {
    renderProvider(withPath);
    fireEvent.press(screen.getByText('consumer'));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith(PATH);
  });

  it('renders the NFC sheet after the children, as a sibling of them', () => {
    renderProvider(withPath);
    const root = screen.toJSON() as any;
    const children = root.children as any[];
    expect(children[children.length - 1].props.testID).toBe('nfc-sheet');
    expect(screen.getByTestId('nfc-sheet').props.nfc).toBe(mockOp);
  });

  it('cancels the op when the sheet cancels, and keeps the review', () => {
    renderProvider(withPath);
    screen.getByTestId('nfc-sheet').props.onCancel();
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  // The provider owns the review screen's title while its tap can run.
  it("keeps the review's title, and names the PIN pad while it is up", () => {
    mockOp.phase = 'pin_entry';
    const view = renderProvider(withPath);
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({
      title: 'Enter Keycard PIN',
    });

    mockOp.phase = 'idle';
    view.rerender(providerTree(PATH, 'Review message'));
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({
      title: 'Review message',
    });
  });

  it("keeps the review when Apple's sheet cancels the tap", () => {
    const view = renderProvider(withPath);
    mockOp.userCancels = 1;
    view.rerender(providerTree(PATH));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('throws when the hook is used outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /within SimulationAddressProvider/,
    );
    spy.mockRestore();
  });

  describe('the operation', () => {
    it('is a PIN-protected read that may retry on tag loss', () => {
      renderProvider(withPath);
      expect(capturedOptions).toEqual({
        requiresPin: true,
        retryOnTagLoss: true,
      });
    });

    it('exports the extended key at the derivation path and derives the address', async () => {
      renderProvider(withPath);
      const checkOK = jest.fn();
      const cmdSet = {
        exportExtendedKey: jest
          .fn()
          .mockResolvedValue({ checkOK, data: new Uint8Array(0) }),
      };
      await expect(capturedOperation!(cmdSet, PATH)).resolves.toBe('0xDerived');
      expect(cmdSet.exportExtendedKey).toHaveBeenCalledWith(0, PATH, false);
      expect(checkOK).toHaveBeenCalled();
      expect(mockPubKeyToEthAddress).toHaveBeenCalledWith(mockPublicKey);
    });

    it('refuses to run without a derivation path', async () => {
      renderProvider({});
      const cmdSet = { exportExtendedKey: jest.fn() };
      await expect(capturedOperation!(cmdSet, undefined)).rejects.toThrow(
        /derivation path/,
      );
      expect(cmdSet.exportExtendedKey).not.toHaveBeenCalled();
    });
  });
});
