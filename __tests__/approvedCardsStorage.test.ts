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

  // The coordinator reads this during a tap. After the first read it has to
  // be a lookup in memory, so it adds nothing to the time on the antenna.
  it('goes to storage once, then answers from memory', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([KEY_A]));
    await loadApprovedCardKeys();
    await loadApprovedCardKeys();
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  // Unreadable storage must approve nothing: the user is asked again, which
  // is the safe direction for a trust decision.
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

  // A failed write must not leave the memory copy claiming the approval was
  // kept: the next launch would not have it, and the two would disagree.
  it('rejects, and remembers nothing, when storage fails', async () => {
    mockSetItem.mockRejectedValue(new Error('storage full'));
    await expect(approveCardKey(KEY_A)).rejects.toThrow('storage full');
    expect(await loadApprovedCardKeys()).toEqual([]);
  });
});
