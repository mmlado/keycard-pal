import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, Linking } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text, Pressable, View } = require('react-native');
  const colors = {
    primary: '#FF6400',
    secondary: '#1C8A80',
    surface: '#1e1e1e',
    background: '#121212',
    onSurface: '#ffffff',
    onSurfaceVariant: '#aaaaaa',
    surfaceVariant: '#2a2a2a',
    error: '#cf6679',
    outline: '#555',
    outlineVariant: '#333',
  };
  return {
    MD3DarkTheme: { colors },
    ActivityIndicator: () =>
      require('react').createElement(Text, null, 'Loading addresses'),
    Button: ({ children, onPress }: any) =>
      require('react').createElement(
        Pressable,
        { onPress },
        require('react').createElement(Text, null, children),
      ),
    RadioButton: {
      Group: ({ children, onValueChange }: any) =>
        require('react').createElement(
          View,
          null,
          children,
          require('react').createElement(
            Pressable,
            {
              onPress: () => onValueChange('0'),
              testID: 'path-group-select',
            },
            require('react').createElement(Text, null, 'Group select'),
          ),
        ),
      Android: ({ onPress, value }: any) =>
        require('react').createElement(Pressable, {
          onPress,
          testID: `radio-${value}`,
        }),
    },
    Text: ({ children, ...rest }: any) =>
      require('react').createElement(Text, rest, children),
  };
});

jest.mock('react-native-svg', () => ({ SvgXml: () => null }));

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = () => require('react').createElement(View);
  return { Icons: { nfcActivate: Icon } };
});

jest.mock('../src/components/AddressText', () => {
  const { Text } = require('react-native');
  return ({ address }: any) =>
    require('react').createElement(Text, null, address);
});

jest.mock('../src/components/PrimaryButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress, disabled }: any) =>
    require('react').createElement(
      Pressable,
      { onPress, disabled },
      require('react').createElement(Text, null, label),
    );
});

jest.mock('../src/components/NFCBottomSheet', () => () => null);

import AddressSelectionPhase from '../src/screens/WalletConnectPairingScreen/AddressSelectionPhase';
import ApprovingPhase from '../src/screens/WalletConnectPairingScreen/ApprovingPhase';
import ProposalPhase from '../src/screens/WalletConnectPairingScreen/ProposalPhase';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

describe('AddressSelectionPhase', () => {
  const addresses = ['0xAAA', '0xBBB', '0xCCC'];

  it('renders address list and action buttons', () => {
    render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress={null}
        loading={false}
        insets={insets}
        onSelect={jest.fn()}
        onLoadMore={jest.fn()}
        onConnect={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Select address')).toBeTruthy();
    expect(screen.getByText('0xAAA')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onSelect when an address row is pressed', async () => {
    const onSelect = jest.fn();
    render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress={null}
        loading={false}
        insets={insets}
        onSelect={onSelect}
        onLoadMore={jest.fn()}
        onConnect={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('0xBBB'));
    expect(onSelect).toHaveBeenCalledWith('0xBBB');
  });

  it('calls onConnect when Connect is pressed', async () => {
    const onConnect = jest.fn();
    render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress="0xAAA"
        loading={false}
        insets={insets}
        onSelect={jest.fn()}
        onLoadMore={jest.fn()}
        onConnect={onConnect}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is pressed', async () => {
    const onCancel = jest.fn();
    render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress={null}
        loading={false}
        insets={insets}
        onSelect={jest.fn()}
        onLoadMore={jest.fn()}
        onConnect={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading footer and keeps selected address checked', () => {
    const onSelect = jest.fn();
    render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress="0xBBB"
        loading={true}
        insets={insets}
        onSelect={onSelect}
        onLoadMore={jest.fn()}
        onConnect={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Loading addresses')).toBeTruthy();
    expect(screen.getByText('0xBBB')).toBeTruthy();
    fireEvent.press(screen.getByTestId('radio-0xBBB'));
    expect(onSelect).toHaveBeenCalledWith('0xBBB');
  });

  it('calls onLoadMore when the list reaches the end', () => {
    const onLoadMore = jest.fn();
    const { UNSAFE_getByType } = render(
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress={null}
        loading={false}
        insets={insets}
        onSelect={jest.fn()}
        onLoadMore={onLoadMore}
        onConnect={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    UNSAFE_getByType(FlatList).props.onEndReached();
    expect(onLoadMore).toHaveBeenCalled();
  });
});

describe('ApprovingPhase', () => {
  it('renders tap prompt and calls onCancel', async () => {
    const onCancel = jest.fn();
    const fakeOp = {
      phase: 'idle',
      status: '',
      result: null,
      start: jest.fn(),
      cancel: jest.fn(),
      submitPin: jest.fn(),
    };
    render(
      <ApprovingPhase
        accountKeyOp={fakeOp as any}
        insets={insets}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Tap Keycard to connect…')).toBeTruthy();
  });
});

const baseProposalProps = {
  dAppName: 'TestApp',
  dAppUrl: 'https://testapp.io',
  requestedChains: ['Ethereum', 'Polygon'],
  pathOptions: [
    {
      label: 'Ethereum (standard)',
      accountPath: "m/44'/60'/0'",
      hasExternalChain: true,
    },
  ],
  selectedPathIdx: 0,
  activeSessionName: null,
  verification: null,
  expiryTimestamp: 0,
  proposalError: null,
  insets,
  onSelectPath: jest.fn(),
  onConfirm: jest.fn(),
  onReject: jest.fn(),
};

describe('ProposalPhase', () => {
  it('renders dApp name, chains, and action buttons', () => {
    render(<ProposalPhase {...baseProposalProps} />);
    expect(screen.getByText('TestApp')).toBeTruthy();
    expect(screen.getByText('Ethereum')).toBeTruthy();
    expect(screen.getByText('Polygon')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('shows VALID verification banner', () => {
    render(
      <ProposalPhase
        {...baseProposalProps}
        verification={{ validation: 'VALID' }}
      />,
    );
    expect(screen.getByText('✓ Verified domain')).toBeTruthy();
  });

  it('shows INVALID verification banner', () => {
    render(
      <ProposalPhase
        {...baseProposalProps}
        verification={{ validation: 'INVALID' }}
      />,
    );
    expect(screen.getByText(/Domain could not be verified/)).toBeTruthy();
  });

  it('shows scam banner when isScam is true', () => {
    render(
      <ProposalPhase
        {...baseProposalProps}
        verification={{ validation: 'VALID', isScam: true }}
      />,
    );
    expect(screen.getByText(/flagged as a scam/)).toBeTruthy();
  });

  it('shows proposalError banner', () => {
    render(
      <ProposalPhase
        {...baseProposalProps}
        proposalError="Required methods not supported: eth_sendTransaction"
      />,
    );
    expect(screen.getByText(/eth_sendTransaction/)).toBeTruthy();
  });

  it('shows countdown when expiryTimestamp is set', () => {
    const future = Math.floor(Date.now() / 1000) + 300;
    render(<ProposalPhase {...baseProposalProps} expiryTimestamp={future} />);
    expect(screen.getByText(/Expires in/)).toBeTruthy();
  });

  it('updates countdown until the proposal expires', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    jest.setSystemTime(now);
    const future = Math.floor(now.getTime() / 1000) + 1;
    render(<ProposalPhase {...baseProposalProps} expiryTimestamp={future} />);

    expect(screen.getByText('Expires in 0:01')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Proposal expired')).toBeTruthy();
  });

  it('shows active session warning', () => {
    render(
      <ProposalPhase {...baseProposalProps} activeSessionName="Uniswap" />,
    );
    expect(screen.getByText(/Uniswap/)).toBeTruthy();
  });

  it('calls onConfirm when Confirm pressed', () => {
    const onConfirm = jest.fn();
    render(<ProposalPhase {...baseProposalProps} onConfirm={onConfirm} />);
    fireEvent.press(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onReject when Reject pressed', () => {
    const onReject = jest.fn();
    render(<ProposalPhase {...baseProposalProps} onReject={onReject} />);
    fireEvent.press(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalled();
  });

  it('renders no verify banner when verification is null', () => {
    render(<ProposalPhase {...baseProposalProps} verification={null} />);
    expect(screen.queryByText(/Verified domain/)).toBeNull();
    expect(screen.queryByText(/could not be verified/)).toBeNull();
    expect(screen.queryByText(/flagged as a scam/)).toBeNull();
  });

  it('renders no verify banner for unknown validation value', () => {
    render(
      <ProposalPhase
        {...baseProposalProps}
        verification={{ validation: 'UNKNOWN' as any }}
      />,
    );
    expect(screen.queryByText(/Verified domain/)).toBeNull();
  });

  it('calls onSelectPath when a path row is pressed', () => {
    const onSelectPath = jest.fn();
    render(
      <ProposalPhase {...baseProposalProps} onSelectPath={onSelectPath} />,
    );
    fireEvent.press(screen.getByText('Ethereum (standard)'));
    expect(onSelectPath).toHaveBeenCalledWith(0);
  });

  it('calls onSelectPath when RadioButton.Group changes value', () => {
    const onSelectPath = jest.fn();
    render(
      <ProposalPhase {...baseProposalProps} onSelectPath={onSelectPath} />,
    );
    fireEvent.press(screen.getByTestId('path-group-select'));
    expect(onSelectPath).toHaveBeenCalledWith(0);
  });

  it('shows the relay privacy notice', () => {
    render(<ProposalPhase {...baseProposalProps} />);
    expect(screen.getByText('Relay privacy notice')).toBeTruthy();
    expect(screen.getByText('WalletConnect Privacy Policy')).toBeTruthy();
  });

  it('opens the WalletConnect privacy policy', () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    render(<ProposalPhase {...baseProposalProps} />);

    fireEvent.press(screen.getByText('WalletConnect Privacy Policy'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://walletconnect.com/privacy',
    );
  });
});
