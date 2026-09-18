import { act, renderHook } from '@testing-library/react-native';

import { useCertificateApprovals } from '../src/hooks/keycard/useCertificateApprovals';

const mockLoadApprovedCardKeys = jest.fn();
const mockApproveCardKey = jest.fn();

jest.mock('../src/storage/approvedCardsStorage', () => ({
  loadApprovedCardKeys: () => mockLoadApprovedCardKeys(),
  approveCardKey: (cardKey: string) => mockApproveCardKey(cardKey),
}));

const KEY_A = '02'.repeat(33);
const KEY_B = '03'.repeat(33);
const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));

async function flush() {
  await act(async () => {});
}

beforeEach(() => {
  mockLoadApprovedCardKeys.mockReset().mockResolvedValue([]);
  mockApproveCardKey.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useCertificateApprovals', () => {
  // Read before any tap, so that reading it during one is a lookup in memory.
  it('warms the approval store when it mounts', async () => {
    renderHook(() => useCertificateApprovals());
    await flush();
    expect(mockLoadApprovedCardKeys).toHaveBeenCalledTimes(1);
  });

  it('survives a store that cannot be read', async () => {
    mockLoadApprovedCardKeys.mockRejectedValueOnce(new Error('unreadable'));
    expect(() => renderHook(() => useCertificateApprovals())).not.toThrow();
    await flush();
  });

  it('whitelists what earlier runs of the app remembered', async () => {
    mockLoadApprovedCardKeys.mockResolvedValue([KEY_A]);
    const { result } = renderHook(() => useCertificateApprovals());
    expect(await result.current.whitelistedCardKeys()).toEqual([bytes(KEY_A)]);
  });

  it('whitelists an approval at once, before it is kept', async () => {
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_B);
    expect(await result.current.whitelistedCardKeys()).toEqual([bytes(KEY_B)]);
    expect(mockApproveCardKey).not.toHaveBeenCalled();
  });

  it('lists a card once when it is both remembered and just approved', async () => {
    mockLoadApprovedCardKeys.mockResolvedValue([KEY_A]);
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_A);
    expect(await result.current.whitelistedCardKeys()).toHaveLength(1);
  });

  // Only the handshake shows the card holds its certificate's key.
  it('keeps an approval once the handshake with that card succeeded', async () => {
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_A);
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    expect(mockApproveCardKey).toHaveBeenCalledWith(KEY_A);
  });

  it('keeps nothing for a card nobody approved', async () => {
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    expect(mockApproveCardKey).not.toHaveBeenCalled();
  });

  it('keeps nothing for a different card than the one approved', async () => {
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_A);
    result.current.handshakeSucceeded(KEY_B);
    await flush();
    expect(mockApproveCardKey).not.toHaveBeenCalled();
  });

  it('writes an approval once, not on every later handshake', async () => {
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_A);
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    expect(mockApproveCardKey).toHaveBeenCalledTimes(1);
  });

  // The approval then still holds from memory, and is tried again next time.
  it('keeps whitelisting from memory when the write fails', async () => {
    mockApproveCardKey.mockRejectedValue(new Error('storage full'));
    const { result } = renderHook(() => useCertificateApprovals());
    result.current.approve(KEY_A);
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    expect(await result.current.whitelistedCardKeys()).toEqual([bytes(KEY_A)]);

    mockApproveCardKey.mockResolvedValue(undefined);
    result.current.handshakeSucceeded(KEY_A);
    await flush();
    expect(mockApproveCardKey).toHaveBeenCalledTimes(2);
  });
});
