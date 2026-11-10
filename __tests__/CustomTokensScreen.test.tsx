import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CUSTOM_TOKENS_EXPLAINER } from '../src/constants/customTokens';
import CustomTokensScreen from '../src/screens/customTokens/CustomTokensScreen';
import { setCustomTokens } from '../src/utils/customTokens';

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const FOO = {
  chainId: 1,
  address: '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef',
  symbol: 'FOO',
  decimals: 6,
};
const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  render(
    <CustomTokensScreen
      navigation={navigation as any}
      route={{ key: 'k', name: 'CustomTokens' } as any}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  setCustomTokens([]);
});

describe('CustomTokensScreen', () => {
  it('says what custom tokens are for while there are none', () => {
    renderScreen();
    expect(screen.getByText(CUSTOM_TOKENS_EXPLAINER)).toBeTruthy();
  });

  it('opens an empty editor from Add token', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('custom-tokens-add'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomToken', {
      mode: 'add',
    });
  });

  it('lists the tokens under their chain names, alphabetically', () => {
    setCustomTokens([
      { ...FOO, chainId: 10, symbol: 'ZED' },
      FOO,
      { ...FOO, chainId: 10, symbol: 'ABC', address: USDC },
    ]);
    renderScreen();
    expect(screen.queryByText(CUSTOM_TOKENS_EXPLAINER)).toBeNull();
    const texts = screen
      .getAllByText(/^(Ethereum Mainnet|OP Mainnet|FOO|ZED|ABC)/)
      .map(node => node.props.children)
      .map(children => (Array.isArray(children) ? children[0] : children));
    expect(texts).toEqual([
      'Ethereum Mainnet',
      'FOO',
      'OP Mainnet',
      'ABC',
      'ZED',
    ]);
    expect(screen.getAllByText(/6 decimals/)).toHaveLength(3);
  });

  it('opens a token in the editor', () => {
    setCustomTokens([FOO]);
    renderScreen();
    fireEvent.press(screen.getByTestId(`custom-token-1-${FOO.address}`));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomToken', {
      mode: 'edit',
      chainId: 1,
      address: FOO.address,
    });
  });

  it('marks a token the bundled list now shadows', () => {
    setCustomTokens([{ ...FOO, address: USDC }]);
    renderScreen();
    expect(
      screen.getByText('Not used: Keycard Pal now knows this token as USDC.'),
    ).toBeTruthy();
  });

  it('follows the list as it changes', () => {
    renderScreen();
    act(() => setCustomTokens([FOO]));
    expect(screen.getByText(/FOO/)).toBeTruthy();
  });
});
