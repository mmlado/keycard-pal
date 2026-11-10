import { act, fireEvent, render, screen } from '@testing-library/react-native';

import {
  ADDRESS_CHECKSUM_ERROR,
  ALREADY_ADDED_ERROR,
  DECIMALS_NOTE,
  DELETE_TOKEN_FAILED,
  SAVE_TOKEN_FAILED,
  SYMBOL_ERROR,
} from '../src/constants/customTokens';
import CustomTokenScreen from '../src/screens/customTokens/CustomTokenScreen';
import { setCustomTokens } from '../src/utils/customTokens';

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSave = jest.fn();
const mockDelete = jest.fn();

jest.mock('../src/storage/customTokensStorage', () => ({
  saveCustomToken: (...args: unknown[]) => mockSave(...args),
  deleteCustomToken: (...args: unknown[]) => mockDelete(...args),
}));

const mockBlock = jest.fn();

jest.mock('../src/navigation/useBlockNativeBack', () => ({
  useBlockNativeBack: (block: boolean) => mockBlock(block),
}));

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ADDRESS = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const FOO = {
  chainId: 1,
  address: ADDRESS.toLowerCase(),
  symbol: 'FOO',
  decimals: 6,
};

type Listener = (event: { preventDefault: () => void }) => void;
let beforeRemove: Listener | null;

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn((_event: string, listener: Listener) => {
    beforeRemove = listener;
    return () => {
      beforeRemove = null;
    };
  }),
};

function renderScreen(params: Record<string, unknown>) {
  return render(
    <CustomTokenScreen
      navigation={navigation as any}
      route={{ key: 'k', name: 'CustomToken', params } as any}
    />,
  );
}

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);

function fill(over: Partial<Record<string, string>> = {}) {
  const values = {
    chain: '1',
    address: ADDRESS,
    symbol: 'FOO',
    decimals: '6',
    ...over,
  };
  for (const [field, text] of Object.entries(values)) {
    type(`custom-token-${field}`, text);
  }
}

const save = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('custom-token-save'));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  setCustomTokens([]);
  beforeRemove = null;
});

describe('CustomTokenScreen: adding', () => {
  it('is titled Add token and saves the entered token, then goes back', async () => {
    renderScreen({ mode: 'add' });
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Add token' });
    fill();
    expect(screen.getByText('Ethereum Mainnet')).toBeTruthy();
    await save();
    expect(mockSave).toHaveBeenCalledWith(FOO);
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('starts from what the review knows', () => {
    renderScreen({
      mode: 'add',
      chainId: 8453,
      address: ADDRESS.toLowerCase(),
    });
    expect(screen.getByTestId('custom-token-chain').props.value).toBe('8453');
    expect(screen.getByTestId('custom-token-address').props.value).toBe(
      ADDRESS,
    );
  });

  it('keeps Save off until every field holds something', () => {
    renderScreen({ mode: 'add' });
    fill({ decimals: '' });
    fireEvent.press(screen.getByTestId('custom-token-save'));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('shows what is wrong once Save is pressed, and saves nothing', async () => {
    renderScreen({ mode: 'add' });
    fill({ symbol: 'F O O' });
    expect(screen.queryByText(SYMBOL_ERROR)).toBeNull();
    await save();
    expect(screen.getByText(SYMBOL_ERROR)).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('judges a whole address at once', () => {
    renderScreen({ mode: 'add' });
    type('custom-token-chain', '1');
    type('custom-token-address', '0xd3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef');
    expect(screen.getByText(ADDRESS_CHECKSUM_ERROR)).toBeTruthy();
    type('custom-token-address', USDC);
    expect(
      screen.getByText(
        'Keycard Pal already knows this token as USDC (6 decimals).',
      ),
    ).toBeTruthy();
  });

  it('points at a token already added instead of adding it twice', () => {
    setCustomTokens([FOO]);
    renderScreen({ mode: 'add' });
    fill();
    expect(screen.getByText(ALREADY_ADDED_ERROR)).toBeTruthy();
    fireEvent.press(screen.getByTestId('custom-token-edit-existing'));
    expect(navigation.replace).toHaveBeenCalledWith('CustomToken', {
      mode: 'edit',
      chainId: 1,
      address: FOO.address,
    });
  });

  it('warns about a duplicate symbol, notes unusual decimals and an unknown chain, and still saves', async () => {
    renderScreen({ mode: 'add' });
    fill({ chain: '987654321', decimals: '24' });
    expect(
      screen.getByText('Keycard Pal does not know chain 987654321.'),
    ).toBeTruthy();
    expect(screen.getByText(DECIMALS_NOTE)).toBeTruthy();
    type('custom-token-chain', '1');
    type('custom-token-symbol', 'usdc');
    expect(
      screen.getByText(
        'Another token on Ethereum Mainnet uses the symbol usdc. Check the contract address.',
      ),
    ).toBeTruthy();
    await save();
    expect(mockSave).toHaveBeenCalledWith({
      ...FOO,
      symbol: 'usdc',
      decimals: 24,
    });
  });

  it('stays with an error line when storage refuses', async () => {
    mockSave.mockRejectedValue(new Error('full'));
    renderScreen({ mode: 'add' });
    fill();
    await save();
    expect(screen.getByText(SAVE_TOKEN_FAILED)).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('CustomTokenScreen: editing', () => {
  beforeEach(() => setCustomTokens([FOO]));

  const renderEdit = () =>
    renderScreen({ mode: 'edit', chainId: 1, address: FOO.address });

  it('shows chain and address fixed, and saves a new symbol and decimals', async () => {
    renderEdit();
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Edit token' });
    expect(screen.queryByTestId('custom-token-chain')).toBeNull();
    expect(screen.queryByTestId('custom-token-address')).toBeNull();
    expect(screen.getByText('Ethereum Mainnet (1)')).toBeTruthy();
    expect(screen.getByTestId('custom-token-symbol').props.value).toBe('FOO');
    type('custom-token-symbol', 'FOO2');
    type('custom-token-decimals', '8');
    await save();
    expect(mockSave).toHaveBeenCalledWith({
      ...FOO,
      symbol: 'FOO2',
      decimals: 8,
    });
  });

  it('asks before deleting, and back closes the question', () => {
    renderEdit();
    fireEvent.press(screen.getByTestId('custom-token-delete'));
    expect(screen.getByText('Delete FOO on Ethereum Mainnet?')).toBeTruthy();
    const preventDefault = jest.fn();
    act(() => beforeRemove?.({ preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(screen.queryByText('Delete FOO on Ethereum Mainnet?')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('keeps the token when the user says Keep', () => {
    renderEdit();
    fireEvent.press(screen.getByTestId('custom-token-delete'));
    fireEvent.press(screen.getByText('Keep'));
    expect(screen.getByTestId('custom-token-symbol')).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes on Delete and leaves without being held back', async () => {
    renderEdit();
    fireEvent.press(screen.getByTestId('custom-token-delete'));
    await act(async () => {
      fireEvent.press(screen.getByText('Delete'));
    });
    expect(mockDelete).toHaveBeenCalledWith(1, FOO.address);
    expect(navigation.goBack).toHaveBeenCalled();
    const preventDefault = jest.fn();
    beforeRemove?.({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('leaves from the question, with back still blocked', async () => {
    let finish = () => {};
    mockDelete.mockReturnValue(
      new Promise<void>(resolve => {
        finish = resolve;
      }),
    );
    renderEdit();
    fireEvent.press(screen.getByTestId('custom-token-delete'));
    fireEvent.press(screen.getByText('Delete'));
    fireEvent.press(screen.getByText('Delete'));
    expect(screen.getByText('Delete FOO on Ethereum Mainnet?')).toBeTruthy();
    expect(mockBlock).toHaveBeenLastCalledWith(true);
    await act(async () => finish());
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockBlock).not.toHaveBeenLastCalledWith(false);
  });

  it('stays with an error line when the delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('disk'));
    renderEdit();
    fireEvent.press(screen.getByTestId('custom-token-delete'));
    await act(async () => {
      fireEvent.press(screen.getByText('Delete'));
    });
    expect(screen.getByText(DELETE_TOKEN_FAILED)).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('says when the bundled list now knows the token', () => {
    setCustomTokens([{ ...FOO, address: USDC.toLowerCase() }]);
    renderScreen({ mode: 'edit', chainId: 1, address: USDC.toLowerCase() });
    expect(
      screen.getByText('Not used: Keycard Pal now knows this token as USDC.'),
    ).toBeTruthy();
  });
});
