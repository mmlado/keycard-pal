import {
  loadTenderlyConfig,
  saveTenderlyCredentials,
  saveTenderlyEnabled,
} from '../src/storage/tenderly.online';

import {
  loadTenderlyConfig as loadOffline,
  saveTenderlyCredentials as saveCredsOffline,
  saveTenderlyEnabled as saveEnabledOffline,
} from '../src/storage/tenderly.offline';

const mockAsyncGetItem = jest.fn();
const mockAsyncSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockAsyncGetItem(...args),
    setItem: (...args: any[]) => mockAsyncSetItem(...args),
  },
}));

const mockSecureGetItem = jest.fn();
const mockSecureSetItem = jest.fn();

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockSecureGetItem(...args),
    setItem: (...args: any[]) => mockSecureSetItem(...args),
  },
}));

describe('tenderly.online storage', () => {
  beforeEach(() => {
    mockAsyncGetItem.mockReset();
    mockAsyncSetItem.mockReset();
    mockSecureGetItem.mockReset();
    mockSecureSetItem.mockReset();
  });

  describe('loadTenderlyConfig', () => {
    it('returns disabled with empty credentials when nothing stored', async () => {
      mockAsyncGetItem.mockResolvedValue(null);
      mockSecureGetItem.mockResolvedValue(null);
      expect(await loadTenderlyConfig()).toEqual({
        enabled: false,
        credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
      });
    });

    it('returns enabled=true and stored credentials', async () => {
      mockAsyncGetItem.mockResolvedValue('true');
      mockSecureGetItem
        .mockResolvedValueOnce('my-account')
        .mockResolvedValueOnce('my-project')
        .mockResolvedValueOnce('my-api-key');
      expect(await loadTenderlyConfig()).toEqual({
        enabled: true,
        credentials: {
          accountSlug: 'my-account',
          projectSlug: 'my-project',
          apiKey: 'my-api-key',
        },
      });
    });

    it('trims whitespace from credential values', async () => {
      mockAsyncGetItem.mockResolvedValue('true');
      mockSecureGetItem
        .mockResolvedValueOnce('  my-account  ')
        .mockResolvedValueOnce('  my-project  ')
        .mockResolvedValueOnce('  key  ');
      const config = await loadTenderlyConfig();
      expect(config.credentials).toEqual({
        accountSlug: 'my-account',
        projectSlug: 'my-project',
        apiKey: 'key',
      });
    });

    it('returns enabled=false when flag is not "true"', async () => {
      mockAsyncGetItem.mockResolvedValue('false');
      mockSecureGetItem
        .mockResolvedValueOnce('acme')
        .mockResolvedValueOnce('proj')
        .mockResolvedValueOnce('key');
      const config = await loadTenderlyConfig();
      expect(config.enabled).toBe(false);
    });

    it('returns defaults when storage throws', async () => {
      mockAsyncGetItem.mockRejectedValue(new Error('storage failure'));
      mockSecureGetItem.mockRejectedValue(new Error('storage failure'));
      expect(await loadTenderlyConfig()).toEqual({
        enabled: false,
        credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
      });
    });
  });

  describe('saveTenderlyEnabled', () => {
    it('stores "true" in AsyncStorage when enabled', async () => {
      mockAsyncSetItem.mockResolvedValue(undefined);
      await saveTenderlyEnabled(true);
      expect(mockAsyncSetItem).toHaveBeenCalledWith('tenderly_enabled', 'true');
      expect(mockSecureSetItem).not.toHaveBeenCalled();
    });

    it('stores "false" in AsyncStorage when disabled', async () => {
      mockAsyncSetItem.mockResolvedValue(undefined);
      await saveTenderlyEnabled(false);
      expect(mockAsyncSetItem).toHaveBeenCalledWith(
        'tenderly_enabled',
        'false',
      );
      expect(mockSecureSetItem).not.toHaveBeenCalled();
    });
  });

  describe('saveTenderlyCredentials', () => {
    it('stores all three credential fields in EncryptedStorage', async () => {
      mockSecureSetItem.mockResolvedValue(undefined);
      await saveTenderlyCredentials({
        accountSlug: 'acme',
        projectSlug: 'proj',
        apiKey: 'key123',
      });
      expect(mockSecureSetItem).toHaveBeenCalledWith(
        'tenderly_account_slug',
        'acme',
      );
      expect(mockSecureSetItem).toHaveBeenCalledWith(
        'tenderly_project_slug',
        'proj',
      );
      expect(mockSecureSetItem).toHaveBeenCalledWith(
        'tenderly_api_key',
        'key123',
      );
      expect(mockAsyncSetItem).not.toHaveBeenCalled();
    });
  });
});

describe('tenderly.offline storage', () => {
  beforeEach(() => {
    mockAsyncGetItem.mockReset();
    mockAsyncSetItem.mockReset();
    mockSecureGetItem.mockReset();
    mockSecureSetItem.mockReset();
  });

  it('loadTenderlyConfig returns disabled with empty credentials', async () => {
    expect(await loadOffline()).toEqual({
      enabled: false,
      credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
    });
    expect(mockAsyncGetItem).not.toHaveBeenCalled();
    expect(mockSecureGetItem).not.toHaveBeenCalled();
  });

  it('saveTenderlyEnabled is a no-op', async () => {
    await saveEnabledOffline(true);
    expect(mockAsyncSetItem).not.toHaveBeenCalled();
    expect(mockSecureSetItem).not.toHaveBeenCalled();
  });

  it('saveTenderlyCredentials is a no-op', async () => {
    await saveCredsOffline({ accountSlug: 'a', projectSlug: 'b', apiKey: 'c' });
    expect(mockAsyncSetItem).not.toHaveBeenCalled();
    expect(mockSecureSetItem).not.toHaveBeenCalled();
  });
});
