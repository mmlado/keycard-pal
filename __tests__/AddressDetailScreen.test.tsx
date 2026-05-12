import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AddressDetailScreen from '../src/screens/address/AddressDetailScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('react-native-qrcode-svg', () => 'QRCode');

const mockEnsAddressLabel = jest.fn();
jest.mock('../src/components/ens/EnsAddressLabel.online', () => ({
  __esModule: true,
  default: (props: { address: string }) => mockEnsAddressLabel(props),
}));

const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: (...args: any[]) => mockSetString(...args) },
}));

// Mock PrimaryButton — capture onPress
jest.mock('../src/components/PrimaryButton', () => jest.fn(() => null));
import PrimaryButton from '../src/components/PrimaryButton';
const MockPrimaryButton = PrimaryButton as jest.MockedFunction<
  typeof PrimaryButton
>;

// Mock Icons so SVGs don't error
jest.mock('../src/assets/icons', () => ({
  Icons: { copy: 'CopyIcon', qr: 'QrIcon' },
}));

// Default: EnsAddressLabel renders just the raw address (no ENS name)
function setupEnsDefault() {
  const { Text } = require('react-native');
  mockEnsAddressLabel.mockImplementation(({ address }: { address: string }) => (
    <Text>{address}</Text>
  ));
}

// ENS resolved: render name above raw address
function setupEnsResolved(name: string) {
  const { Text, View } = require('react-native');
  mockEnsAddressLabel.mockImplementation(({ address }: { address: string }) => (
    <View>
      <Text>{name}</Text>
      <Text>{address}</Text>
    </View>
  ));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ETH_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const INDEX = 7;

const navigation = { setOptions: jest.fn() } as any;

function makeRoute(address = ETH_ADDRESS, index = INDEX) {
  return {
    key: 'AddressDetail',
    name: 'AddressDetail',
    params: { address, index },
  } as any;
}

function renderScreen(address = ETH_ADDRESS, index = INDEX) {
  return render(
    <AddressDetailScreen
      navigation={navigation}
      route={makeRoute(address, index)}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddressDetailScreen', () => {
  beforeEach(() => {
    mockSetString.mockClear();
    MockPrimaryButton.mockClear();
    mockEnsAddressLabel.mockClear();
    navigation.setOptions.mockClear();
    setupEnsDefault();
  });

  describe('layout', () => {
    it('renders the address text', () => {
      renderScreen();
      expect(screen.getByText(ETH_ADDRESS)).toBeTruthy();
    });

    it('passes the address to QRCode', () => {
      const { toJSON } = renderScreen();
      const json = JSON.stringify(toJSON());
      expect(json).toContain(ETH_ADDRESS);
    });

    it('renders the Copy Address button', () => {
      renderScreen();
      expect(MockPrimaryButton).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Copy Address' }),
        undefined,
      );
    });
  });

  describe('title', () => {
    it('sets the navigation title to the address index', () => {
      renderScreen(ETH_ADDRESS, 5);
      expect(navigation.setOptions).toHaveBeenCalledWith({ title: '5' });
    });

    it('uses a custom title when provided', () => {
      render(
        <AddressDetailScreen
          navigation={navigation}
          route={
            {
              key: 'AddressDetail',
              name: 'AddressDetail',
              params: {
                address: ETH_ADDRESS,
                index: 0,
                title: 'Ethereum address',
              },
            } as any
          }
        />,
      );
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Ethereum address',
      });
    });
  });

  describe('copy', () => {
    it('copies the address to clipboard when the button is pressed', () => {
      renderScreen();
      const onPress = MockPrimaryButton.mock.calls[0][0].onPress;
      onPress();
      expect(mockSetString).toHaveBeenCalledWith(ETH_ADDRESS);
    });
  });

  describe('ENS', () => {
    it('shows ENS name and raw address when name resolves', () => {
      setupEnsResolved('vitalik.eth');
      renderScreen();
      expect(screen.getByText('vitalik.eth')).toBeTruthy();
      expect(screen.getByText(ETH_ADDRESS)).toBeTruthy();
    });

    it('passes raw address to QRCode even when ENS name is shown', () => {
      setupEnsResolved('vitalik.eth');
      const { toJSON } = renderScreen();
      const json = JSON.stringify(toJSON());
      expect(json).toContain(ETH_ADDRESS);
    });

    it('copy button still copies raw address when ENS name is shown', () => {
      setupEnsResolved('vitalik.eth');
      renderScreen();
      const onPress = MockPrimaryButton.mock.calls[0][0].onPress;
      onPress();
      expect(mockSetString).toHaveBeenCalledWith(ETH_ADDRESS);
    });
  });
});
