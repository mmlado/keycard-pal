import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getAddress } from 'viem';

import {
  clearEnsNameCache,
  useEnsName,
} from '../src/hooks/ens/useEnsName.online';
import { useEnsName as useEnsNameOffline } from '../src/hooks/ens/useEnsName.offline';

const mockLoadEnsSettings = jest.fn();
const mockResolveEnsName = jest.fn();

jest.mock('../src/storage/ensSettings.online', () => ({
  loadEnsSettings: (...args: any[]) => mockLoadEnsSettings(...args),
}));

jest.mock('../src/utils/ens/client.online', () => ({
  resolveEnsName: (...args: any[]) => mockResolveEnsName(...args),
}));

jest.mock('viem', () => ({
  getAddress: jest.fn((addr: string) => addr),
}));

const mockedGetAddress = getAddress as jest.MockedFunction<typeof getAddress>;

const DISABLED = { enabled: false, rpcUrl: '' };
const enabled = (rpcUrl: string) => ({ enabled: true, rpcUrl });

describe('useEnsName.online', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(() => {
    clearEnsNameCache();
    jest.clearAllMocks();
    mockedGetAddress.mockImplementation(
      (addr: string) => addr as `0x${string}`,
    );
  });

  it('returns no name when ENS is disabled; no resolver call', async () => {
    mockLoadEnsSettings.mockResolvedValue(DISABLED);

    const { result } = renderHook(() => useEnsName(address));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.name).toBeNull();
    expect(result.current.error).toBe(false);
    expect(mockResolveEnsName).not.toHaveBeenCalled();
  });

  it('confirmed name is cached and returned synchronously on second call', async () => {
    mockLoadEnsSettings.mockResolvedValue(enabled('https://rpc.example.com'));
    mockResolveEnsName.mockResolvedValue({ name: 'vitalik.eth' });

    const { result, unmount } = renderHook(() => useEnsName(address));
    await waitFor(() => expect(result.current.name).toBe('vitalik.eth'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);

    unmount();

    const { result: result2 } = renderHook(() => useEnsName(address));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.name).toBe('vitalik.eth');
    expect(result2.current.error).toBe(false);
    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);
  });

  it('not-found returns empty string name, error: false; retry is a no-op', async () => {
    mockLoadEnsSettings.mockResolvedValue(enabled('https://rpc.example.com'));
    mockResolveEnsName.mockResolvedValue({ name: null, reason: 'not-found' });

    const { result } = renderHook(() => useEnsName(address));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.name).toBe('');
    expect(result.current.error).toBe(false);

    act(() => {
      result.current.retry();
    });

    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);
  });

  it('mismatch returns empty string name, error: false; retry is a no-op', async () => {
    mockLoadEnsSettings.mockResolvedValue(enabled('https://rpc.example.com'));
    mockResolveEnsName.mockResolvedValue({ name: null, reason: 'mismatch' });

    const { result } = renderHook(() => useEnsName(address));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.name).toBe('');
    expect(result.current.error).toBe(false);

    act(() => {
      result.current.retry();
    });

    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);
  });

  it('rpc-error returns error: true; calling retry triggers another resolver call', async () => {
    mockLoadEnsSettings.mockResolvedValue(enabled('https://rpc.example.com'));
    mockResolveEnsName
      .mockResolvedValueOnce({ name: null, reason: 'rpc-error' })
      .mockResolvedValueOnce({ name: 'vitalik.eth' });

    const { result } = renderHook(() => useEnsName(address));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.name).toBeNull();
    expect(result.current.error).toBe(true);
    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.name).toBe('vitalik.eth'));
    expect(result.current.error).toBe(false);
    expect(mockResolveEnsName).toHaveBeenCalledTimes(2);
  });

  it('retry is no-op when last failure is not rpc-error (success state)', async () => {
    mockLoadEnsSettings.mockResolvedValue(enabled('https://rpc.example.com'));
    mockResolveEnsName.mockResolvedValue({ name: 'vitalik.eth' });

    const { result } = renderHook(() => useEnsName(address));
    await waitFor(() => expect(result.current.name).toBe('vitalik.eth'));

    act(() => {
      result.current.retry();
    });

    expect(mockResolveEnsName).toHaveBeenCalledTimes(1);
  });
});

describe('useEnsName.online — invalid address', () => {
  beforeEach(() => {
    clearEnsNameCache();
    mockResolveEnsName.mockReset();
  });

  it('returns no name, no loading, no error for invalid address', async () => {
    mockedGetAddress.mockImplementationOnce(() => {
      throw new Error('invalid address');
    });

    const { result } = renderHook(() => useEnsName('not-an-address'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.name).toBeNull();
    expect(result.current.error).toBe(false);
    expect(mockResolveEnsName).not.toHaveBeenCalled();
  });
});

describe('useEnsName.offline', () => {
  it('returns no name, no error, no loading', () => {
    const { result } = renderHook(() => useEnsNameOffline('0x123'));

    expect(result.current.name).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.retry).toBeInstanceOf(Function);
  });
});
