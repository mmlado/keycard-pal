import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EnsAddressLabel from '../src/components/ens/EnsAddressLabel.online';
import EnsAddressLabelOffline from '../src/components/ens/EnsAddressLabel.offline';

const mockUseEnsName = jest.fn();

jest.mock('../src/hooks/ens/useEnsName.online', () => ({
  useEnsName: () => mockUseEnsName(),
}));

const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

beforeEach(() => {
  mockUseEnsName.mockReset();
});

describe('EnsAddressLabel.online', () => {
  it('confirmed name renders above raw address', () => {
    mockUseEnsName.mockReturnValue({
      name: 'vitalik.eth',
      loading: false,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText('vitalik.eth')).toBeTruthy();
    expect(screen.getByText(address)).toBeTruthy();
  });

  it('cache hit renders name synchronously with no loading state', () => {
    mockUseEnsName.mockReturnValue({
      name: 'vitalik.eth',
      loading: false,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText('vitalik.eth')).toBeTruthy();
    expect(screen.getByText(address)).toBeTruthy();
  });

  it('cache miss renders raw address until name resolves', () => {
    mockUseEnsName.mockReturnValue({
      name: null,
      loading: true,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.queryByText('vitalik.eth')).toBeNull();
  });

  it('not-found renders raw address only, no error indicator, no Refresh', () => {
    mockUseEnsName.mockReturnValue({
      name: null,
      loading: false,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.queryByText('ENS unavailable')).toBeNull();
    expect(screen.queryByText('Refresh')).toBeNull();
  });

  it('mismatch renders raw address only, no error indicator, no Refresh', () => {
    mockUseEnsName.mockReturnValue({
      name: null,
      loading: false,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.queryByText('ENS unavailable')).toBeNull();
    expect(screen.queryByText('Refresh')).toBeNull();
  });

  it('no-ens renders raw address + "no ens" label, no error indicator', () => {
    mockUseEnsName.mockReturnValue({
      name: '',
      loading: false,
      error: false,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.getByText('no ens')).toBeTruthy();
    expect(screen.queryByText(/ENS unavailable/)).toBeNull();
    expect(screen.queryByText('Refresh')).toBeNull();
  });

  it('rpc-error renders raw address + error indicator + Refresh button', () => {
    mockUseEnsName.mockReturnValue({
      name: null,
      loading: false,
      error: true,
      retry: jest.fn(),
    });

    render(<EnsAddressLabel address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
    expect(screen.getByText(/ENS unavailable/)).toBeTruthy();
    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  it('tapping Refresh calls retry', () => {
    const retry = jest.fn();
    mockUseEnsName.mockReturnValue({
      name: null,
      loading: false,
      error: true,
      retry,
    });

    render(<EnsAddressLabel address={address} />);

    fireEvent.press(screen.getByText('Refresh'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('EnsAddressLabel.offline', () => {
  it('renders only raw address', () => {
    render(<EnsAddressLabelOffline address={address} />);

    expect(screen.getByText(address)).toBeTruthy();
  });
});
