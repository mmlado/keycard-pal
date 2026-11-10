import {
  deleteCustomToken,
  restoreCustomTokens,
  saveCustomToken,
} from '../src/storage/customTokensStorage';
import { getCustomTokens, setCustomTokens } from '../src/utils/customTokens';

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockStore.get(key) ?? null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

const AsyncStorage = jest.requireMock(
  '@react-native-async-storage/async-storage',
) as { getItem: jest.Mock; setItem: jest.Mock };

const KEY = 'custom_tokens';
const FOO = {
  chainId: 1,
  address: '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef',
  symbol: 'FOO',
  decimals: 18,
};
const BAR = { ...FOO, chainId: 10, symbol: 'BAR' };

const stored = () => JSON.parse(mockStore.get(KEY) ?? 'null');

beforeEach(() => {
  mockStore.clear();
  setCustomTokens([]);
  jest.clearAllMocks();
});

describe('restoreCustomTokens', () => {
  it('loads the stored list into memory', async () => {
    mockStore.set(KEY, JSON.stringify([FOO, BAR]));
    await restoreCustomTokens();
    expect(getCustomTokens()).toEqual([FOO, BAR]);
  });

  it('starts empty when nothing is stored, the text is no JSON, or the read fails', async () => {
    await restoreCustomTokens();
    expect(getCustomTokens()).toEqual([]);

    mockStore.set(KEY, '[{');
    await restoreCustomTokens();
    expect(getCustomTokens()).toEqual([]);

    AsyncStorage.getItem.mockRejectedValueOnce(new Error('disk'));
    await expect(restoreCustomTokens()).resolves.toBeUndefined();
    expect(getCustomTokens()).toEqual([]);
  });
});

describe('saveCustomToken', () => {
  it('adds a token with its address in lowercase, to storage and memory', async () => {
    await saveCustomToken({
      ...FOO,
      address: '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef',
    });
    expect(stored()).toEqual([FOO]);
    expect(getCustomTokens()).toEqual([FOO]);
  });

  it('replaces the token at the same chain and address', async () => {
    await saveCustomToken(FOO);
    await saveCustomToken(BAR);
    await saveCustomToken({ ...FOO, symbol: 'FOO2', decimals: 6 });
    expect(getCustomTokens()).toEqual([
      { ...FOO, symbol: 'FOO2', decimals: 6 },
      BAR,
    ]);
  });

  it('keeps the list as it was when storage refuses', async () => {
    await saveCustomToken(FOO);
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('full'));
    await expect(saveCustomToken(BAR)).rejects.toThrow('full');
    expect(getCustomTokens()).toEqual([FOO]);
    expect(stored()).toEqual([FOO]);
  });

  it('builds each write on the one before it', async () => {
    await Promise.all([saveCustomToken(FOO), saveCustomToken(BAR)]);
    expect(stored()).toEqual([FOO, BAR]);
  });

  it('runs the next write after a failed one', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('full'));
    const failed = saveCustomToken(FOO);
    const next = saveCustomToken(BAR);
    await expect(failed).rejects.toThrow('full');
    await next;
    expect(getCustomTokens()).toEqual([BAR]);
  });
});

describe('deleteCustomToken', () => {
  it('removes the token at that chain and address', async () => {
    await saveCustomToken(FOO);
    await saveCustomToken(BAR);
    await deleteCustomToken(1, FOO.address.toUpperCase().replace('0X', '0x'));
    expect(getCustomTokens()).toEqual([BAR]);
    expect(stored()).toEqual([BAR]);
  });

  it('keeps the token when storage refuses', async () => {
    await saveCustomToken(FOO);
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk'));
    await expect(deleteCustomToken(1, FOO.address)).rejects.toThrow('disk');
    expect(getCustomTokens()).toEqual([FOO]);
  });
});
