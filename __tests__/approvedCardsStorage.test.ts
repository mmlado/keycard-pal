import {
  approveCardKey,
  loadApprovedCardKeys,
  resetApprovedCardKeysCache,
} from '../src/storage/approvedCardsStorage';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

const KEY_A = '02'.repeat(33);
const KEY_B = '03'.repeat(33);

beforeEach(() => {
  resetApprovedCardKeysCache();
  mockGetItem.mockReset().mockResolvedValue(null);
  mockSetItem.mockReset().mockResolvedValue(undefined);
});

describe('loadApprovedCardKeys', () => {
  it('approves nothing on a fresh install', async () => {
    expect(await loadApprovedCardKeys()).toEqual([]);
  });

  it('reads what was stored', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([KEY_A, KEY_B]));
    expect(await loadApprovedCardKeys()).toEqual([KEY_A, KEY_B]);
  });

  // Read during a tap, so after the first read it must come from memory.
  it('goes to storage once, then answers from memory', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([KEY_A]));
    await loadApprovedCardKeys();
    await loadApprovedCardKeys();
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  // Unreadable storage approves nothing.
  it.each([
    [
      'storage that throws',
      () => mockGetItem.mockRejectedValue(new Error('x')),
    ],
    [
      'something that is not JSON',
      () => mockGetItem.mockResolvedValue('{oops'),
    ],
    ['JSON that is not a list', () => mockGetItem.mockResolvedValue('{"a":1}')],
  ])('approves nothing for %s', async (_name, arrange) => {
    arrange();
    expect(await loadApprovedCardKeys()).toEqual([]);
  });

  it('drops entries that are not card keys', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify([KEY_A, 7, null, 'not hex', '', KEY_B]),
    );
    expect(await loadApprovedCardKeys()).toEqual([KEY_A, KEY_B]);
  });
});

describe('approveCardKey', () => {
  it('stores the key alongside the ones already there', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([KEY_A]));
    await approveCardKey(KEY_B);
    expect(mockSetItem).toHaveBeenCalledWith(
      'approved_card_keys',
      JSON.stringify([KEY_A, KEY_B]),
    );
    expect(await loadApprovedCardKeys()).toEqual([KEY_A, KEY_B]);
  });

  it('does not write a key that is already approved', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([KEY_A]));
    await approveCardKey(KEY_A);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  // A failed write must not stay approved in memory.
  it('rejects, and remembers nothing, when storage fails', async () => {
    mockSetItem.mockRejectedValue(new Error('storage full'));
    await expect(approveCardKey(KEY_A)).rejects.toThrow('storage full');
    expect(await loadApprovedCardKeys()).toEqual([]);
  });
});
