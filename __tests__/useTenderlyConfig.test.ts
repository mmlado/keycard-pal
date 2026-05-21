import { renderHook, waitFor } from '@testing-library/react-native';

import { useTenderlyConfig } from '../src/hooks/useTenderlyConfig.online';
import { useTenderlyConfig as useTenderlyConfigOffline } from '../src/hooks/useTenderlyConfig.offline';

const mockLoadTenderlyConfig = jest.fn();

jest.mock('../src/storage/tenderly.online', () => ({
  loadTenderlyConfig: (...args: any[]) => mockLoadTenderlyConfig(...args),
}));

const CREDS = { accountSlug: 'acme', projectSlug: 'proj', apiKey: 'key123' };

describe('useTenderlyConfig.online', () => {
  beforeEach(() => {
    mockLoadTenderlyConfig.mockReset();
  });

  it('returns null credentials initially', () => {
    mockLoadTenderlyConfig.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTenderlyConfig());
    expect(result.current.credentials).toBeNull();
  });

  it('returns null when disabled', async () => {
    mockLoadTenderlyConfig.mockResolvedValue({
      enabled: false,
      credentials: CREDS,
    });
    const { result } = renderHook(() => useTenderlyConfig());
    await waitFor(() => expect(mockLoadTenderlyConfig).toHaveBeenCalled());
    expect(result.current.credentials).toBeNull();
  });

  it('returns null when any credential field is empty', async () => {
    mockLoadTenderlyConfig.mockResolvedValue({
      enabled: true,
      credentials: { accountSlug: '', projectSlug: 'proj', apiKey: 'key' },
    });
    const { result } = renderHook(() => useTenderlyConfig());
    await waitFor(() => expect(result.current.credentials).toBeNull());
  });

  it('returns credentials when enabled and all fields set', async () => {
    mockLoadTenderlyConfig.mockResolvedValue({
      enabled: true,
      credentials: CREDS,
    });
    const { result } = renderHook(() => useTenderlyConfig());
    await waitFor(() => expect(result.current.credentials).toEqual(CREDS));
  });

  it('returns null when storage throws', async () => {
    mockLoadTenderlyConfig.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTenderlyConfig());
    // stays null after rejection (catch swallows error)
    await waitFor(() => expect(mockLoadTenderlyConfig).toHaveBeenCalled());
    expect(result.current.credentials).toBeNull();
  });
});

describe('useTenderlyConfig.offline', () => {
  it('always returns null credentials', () => {
    const { result } = renderHook(() => useTenderlyConfigOffline());
    expect(result.current.credentials).toBeNull();
  });
});
