import React from 'react';
import { render, screen } from '@testing-library/react-native';

import TokenSymbolRow from '../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection/TokenSymbolRow';

import type { TokenMetadata } from '../src/utils/tokenMetadata';

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { Text: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('../src/theme', () => ({
  __esModule: true,
  default: { colors: { onSurfaceVariant: '#aaa' } },
}));

let mockImagesEnabled = false;
jest.mock('../src/hooks/useTokenImagesEnabled.online', () => ({
  __esModule: true,
  default: () => mockImagesEnabled,
}));

jest.mock('../src/utils/buildConfig', () => ({
  INTERNET_ENABLED: true,
}));

const remoteToken: TokenMetadata = {
  symbol: 'USDC',
  decimals: 6,
  logoURI: 'https://example.com/usdc.png',
};

const localToken: TokenMetadata = {
  symbol: 'USDC',
  decimals: 6,
  logoURI: 'asset:/token-logos/1-0xabc.png',
};

const noLogoToken: TokenMetadata = { symbol: 'USDC', decimals: 6 };

describe('TokenSymbolRow', () => {
  beforeEach(() => {
    mockImagesEnabled = false;
  });

  it('always renders the token symbol', () => {
    render(<TokenSymbolRow token={noLogoToken} />);
    expect(screen.getByText('USDC')).toBeTruthy();
  });

  it('hides remote logo when token images are disabled', () => {
    mockImagesEnabled = false;
    render(<TokenSymbolRow token={remoteToken} />);
    expect(screen.queryByTestId('token-logo')).toBeNull();
  });

  it('shows remote logo when token images are enabled', () => {
    mockImagesEnabled = true;
    render(<TokenSymbolRow token={remoteToken} />);
    expect(screen.getByTestId('token-logo').props.source).toEqual({
      uri: 'https://example.com/usdc.png',
    });
  });

  it('shows local asset logo regardless of images-enabled preference', () => {
    mockImagesEnabled = false;
    render(<TokenSymbolRow token={localToken} />);
    expect(screen.getByTestId('token-logo').props.source).toEqual({
      uri: 'asset:/token-logos/1-0xabc.png',
    });
  });

  it('renders nothing for logoURI when token has no logo', () => {
    mockImagesEnabled = true;
    render(<TokenSymbolRow token={noLogoToken} />);
    expect(screen.queryByTestId('token-logo')).toBeNull();
  });
});
