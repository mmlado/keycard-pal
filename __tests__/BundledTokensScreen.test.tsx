import { SectionList } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import BundledTokensScreen, {
  NO_BUNDLED_TOKEN_MATCH,
} from '../src/screens/BundledTokensScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const renderScreen = () =>
  render(
    <BundledTokensScreen
      navigation={{ navigate: jest.fn() } as any}
      route={{ key: 'k', name: 'BundledTokens' } as any}
    />,
  );

afterEach(() => jest.restoreAllMocks());

describe('BundledTokensScreen', () => {
  it('finds a token by symbol and shows its decimals and checksummed address', () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('bundled-tokens-filter'), 'usdc');
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-1'));
    const row = screen.getByTestId(`bundled-token-1-${USDC}`);
    expect(row).toBeTruthy();
    // The chip and the section header.
    expect(screen.getAllByText('Ethereum Mainnet')).toHaveLength(2);
    expect(screen.getAllByText('  6 decimals').length).toBeGreaterThan(0);
    expect(screen.getByText('A0b8')).toBeTruthy();
  });

  it('finds a token by address', () => {
    renderScreen();
    fireEvent.changeText(
      screen.getByTestId('bundled-tokens-filter'),
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
    expect(screen.getByTestId(`bundled-token-1-${USDC}`)).toBeTruthy();
  });

  it('shows only the chosen chain, and every chain again from All chains', () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('bundled-tokens-filter'), 'usdc');
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-10'));
    expect(screen.queryByTestId(`bundled-token-1-${USDC}`)).toBeNull();
    expect(
      screen.getByTestId('bundled-tokens-chain-10').props.accessibilityState,
    ).toEqual({ selected: true });
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-all'));
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-1'));
    expect(screen.getByTestId(`bundled-token-1-${USDC}`)).toBeTruthy();
  });

  it('points to Custom tokens when nothing matches', () => {
    renderScreen();
    expect(screen.queryByText(NO_BUNDLED_TOKEN_MATCH)).toBeNull();
    fireEvent.changeText(
      screen.getByTestId('bundled-tokens-filter'),
      'no-such-symbol',
    );
    expect(screen.getByText(NO_BUNDLED_TOKEN_MATCH)).toBeTruthy();
  });

  it('shows a new filter or chain from its first match', () => {
    const scrollTo = jest.fn();
    jest
      .spyOn(SectionList.prototype, 'getScrollResponder')
      .mockReturnValue({ scrollTo } as any);
    renderScreen();
    fireEvent.changeText(screen.getByTestId('bundled-tokens-filter'), 'usd');
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-10'));
    fireEvent.press(screen.getByTestId('bundled-tokens-chain-all'));
    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });
});
