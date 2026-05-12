import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AboutScreen from '../src/screens/AboutScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseNavigationNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockUseNavigationNavigate }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
  };
});

const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    setString: (value: string) => mockSetString(value),
  },
}));

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return {
    Icons: {
      chevronRight: Icon,
      close: Icon,
      copy: Icon,
      openInBrowser: Icon,
      qr: Icon,
    },
  };
});

const bitcoinAddress = 'bc1qpncfjnresszndse506zmvjya05xcs6493cm8xf';
const ethereumAddress = '0xF665E3D58DABa87d741A347674DCc4C4b794cAc9';

const navigation = {
  navigate: jest.fn(),
} as any;

function renderScreen() {
  return render(<AboutScreen navigation={navigation} route={{} as any} />);
}

describe('AboutScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    mockUseNavigationNavigate.mockClear();
    mockSetString.mockClear();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the app, icon, project link, Keycard, support, contributors, and license sections', () => {
    renderScreen();
    expect(screen.getAllByText('GapSign').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('GapSign app icon')).toBeTruthy();
    expect(screen.getByText('GitHub project')).toBeTruthy();
    expect(screen.getByText(/Keycard required/)).toBeTruthy();
    expect(screen.getByText('Buy me a coffee')).toBeTruthy();
    expect(screen.getByText(bitcoinAddress)).toBeTruthy();
    expect(screen.getByText(ethereumAddress)).toBeTruthy();
    const labels = screen
      .getAllByText(/Ethereum|Bitcoin/)
      .map(node => node.props.children)
      .filter(text => text === 'Ethereum' || text === 'Bitcoin');
    expect(labels).toEqual(['Ethereum', 'Bitcoin']);
    expect(screen.getByText('Open-source licenses')).toBeTruthy();
  });

  it('opens the project GitHub page', () => {
    renderScreen();
    fireEvent.press(screen.getByText('GitHub project'));
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://github.com/mmlado/GapSign',
    );
  });

  it('copies support addresses', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Copy Bitcoin address'));
    expect(mockSetString).toHaveBeenCalledWith(bitcoinAddress);

    fireEvent.press(screen.getByLabelText('Copy Ethereum address'));
    expect(mockSetString).toHaveBeenCalledWith(ethereumAddress);
  });

  it('opens support addresses as QR codes', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Show Bitcoin QR code'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddressDetail', {
      address: bitcoinAddress,
      index: 0,
      title: 'Bitcoin address',
    });

    fireEvent.press(screen.getByLabelText('Show Ethereum QR code'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddressDetail', {
      address: ethereumAddress,
      index: 0,
      title: 'Ethereum address',
    });
  });

  it('navigates to license details from a license row', () => {
    renderScreen();
    fireEvent.press(screen.getByText('@ethereumjs/rlp'));
    expect(navigation.navigate).toHaveBeenCalledWith('LicenseDetail', {
      packageName: '@ethereumjs/rlp',
      licenseType: 'MPL-2.0',
    });
  });

  it('shows QR for the GitHub project link', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Show GitHub project QR code'));
    expect(navigation.navigate).toHaveBeenCalledWith('UrlQR', {
      url: 'https://github.com/mmlado/GapSign',
      title: 'GitHub project',
    });
  });

  it('shows QR for a contributor profile', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/Show QR code for .+/));
    expect(mockUseNavigationNavigate).toHaveBeenCalledWith('UrlQR', {
      url: expect.stringContaining('github.com'),
      title: expect.any(String),
    });
  });

  it('opens a contributor profile in the browser', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/Open .* GitHub profile/));
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
    );
  });
});
