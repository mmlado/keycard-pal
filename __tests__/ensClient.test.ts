import { createPublicClient, getAddress, http } from 'viem';

import { resolveEnsName as resolveOffline } from '../src/utils/ens/client.offline';
import { resolveEnsName, validateRpcUrl } from '../src/utils/ens/client.online';

const mockGetEnsName = jest.fn();
const mockGetEnsAddress = jest.fn();
const mockGetChainId = jest.fn();
const mockClient = {
  getEnsName: mockGetEnsName,
  getEnsAddress: mockGetEnsAddress,
  getChainId: mockGetChainId,
};

jest.mock('viem', () => ({
  getAddress: jest.fn((addr: string) => addr),
  createPublicClient: jest.fn(() => mockClient),
  http: jest.fn(),
}));

jest.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'Mainnet' },
}));

const mockedGetAddress = getAddress as jest.MockedFunction<typeof getAddress>;
const mockedCreatePublicClient = createPublicClient as jest.MockedFunction<
  typeof createPublicClient
>;
const mockedHttp = http as jest.MockedFunction<typeof http>;

describe('client.online', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const rpcUrl = 'https://rpc.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreatePublicClient.mockReturnValue(mockClient as any);
  });

  describe('resolveEnsName', () => {
    it('checksums lowercase address before lookup', async () => {
      const lowerAddress = address.toLowerCase();
      mockedGetAddress.mockReturnValue(address);
      mockGetEnsName.mockResolvedValue(null);

      await resolveEnsName(lowerAddress, rpcUrl);

      expect(mockedGetAddress).toHaveBeenCalledWith(lowerAddress);
      expect(mockGetEnsName).toHaveBeenCalledWith({ address });
    });

    it('returns confirmed name on reverse + forward match', async () => {
      mockedGetAddress.mockImplementation((addr: string) => addr);
      mockGetEnsName.mockResolvedValue('vitalik.eth');
      mockGetEnsAddress.mockResolvedValue(address);

      const result = await resolveEnsName(address, rpcUrl);

      expect(result).toEqual({ name: 'vitalik.eth' });
    });

    it('returns mismatch when forward resolves to different address', async () => {
      mockedGetAddress.mockImplementation((addr: string) => addr);
      mockGetEnsName.mockResolvedValue('vitalik.eth');
      mockGetEnsAddress.mockResolvedValue(
        '0xabcdef1234567890abcdef1234567890abcdef12',
      );

      const result = await resolveEnsName(address, rpcUrl);

      expect(result).toEqual({ name: null, reason: 'mismatch' });
    });

    it('returns not-found when no reverse record', async () => {
      mockedGetAddress.mockImplementation((addr: string) => addr);
      mockGetEnsName.mockResolvedValue(null);

      const result = await resolveEnsName(address, rpcUrl);

      expect(result).toEqual({ name: null, reason: 'not-found' });
    });

    it('returns rpc-error on network failure', async () => {
      mockedGetAddress.mockImplementation((addr: string) => addr);
      mockGetEnsName.mockRejectedValue(new Error('network error'));

      const result = await resolveEnsName(address, rpcUrl);

      expect(result).toEqual({ name: null, reason: 'rpc-error' });
    });
  });

  describe('validateRpcUrl', () => {
    it('returns ok for mainnet chainId 1', async () => {
      mockGetChainId.mockResolvedValue(1);

      const result = await validateRpcUrl(rpcUrl);

      expect(result).toBe('ok');
      expect(mockedHttp).toHaveBeenCalledWith(rpcUrl, { timeout: 5000 });
    });

    it('returns non-mainnet for other chainIds', async () => {
      mockGetChainId.mockResolvedValue(137);

      const result = await validateRpcUrl(rpcUrl);

      expect(result).toBe('non-mainnet');
    });

    it('returns timeout on timeout error', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';
      mockGetChainId.mockRejectedValue(timeoutError);

      const result = await validateRpcUrl(rpcUrl);

      expect(result).toBe('timeout');
    });

    it('returns unreachable on other failures', async () => {
      mockGetChainId.mockRejectedValue(new Error('network error'));

      const result = await validateRpcUrl(rpcUrl);

      expect(result).toBe('unreachable');
    });
  });
});

describe('client.offline', () => {
  it('resolveEnsName returns not-found', async () => {
    const result = await resolveOffline('0x123', 'https://rpc');

    expect(result).toEqual({ name: null, reason: 'not-found' });
  });
});
