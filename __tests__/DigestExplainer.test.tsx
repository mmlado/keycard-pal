import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import {
  ERC8213_LINK_LABEL,
  ERC8213_QR_TITLE,
  ERC8213_URL,
} from '../src/constants/erc8213';

import { DigestExplainer } from '../src/components/SignRequestDetail/eth/DataTabPanel/shared';

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockConnected = true;
jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

describe('DigestExplainer', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockConnected = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the explanation and the ERC-8213 link', () => {
    render(<DigestExplainer text="What a digest is." />);

    expect(screen.getByText('What a digest is.')).toBeTruthy();
    expect(screen.getByText(ERC8213_LINK_LABEL)).toBeTruthy();
  });

  it('opens the spec in the browser when the phone has a network', async () => {
    render(<DigestExplainer text="What a digest is." />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('erc8213-link'));
    });

    expect(Linking.openURL).toHaveBeenCalledWith(ERC8213_URL);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the spec URL as a QR code when there is no network', async () => {
    mockConnected = false;
    render(<DigestExplainer text="What a digest is." />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('erc8213-link'));
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: ERC8213_URL,
      title: ERC8213_QR_TITLE,
      note: undefined,
    });
  });
});
