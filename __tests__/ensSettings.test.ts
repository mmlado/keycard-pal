import {
  DEFAULT_ENS_RPC_URL,
  loadEnsSettings,
  saveEnsEnabled,
  saveEnsRpcUrl,
} from '../src/storage/ensSettings.online';

import {
  DEFAULT_ENS_RPC_URL as DEFAULT_OFFLINE,
  loadEnsSettings as loadSettingsOffline,
  saveEnsEnabled as saveEnabledOffline,
  saveEnsRpcUrl as saveOffline,
} from '../src/storage/ensSettings.offline';

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

describe('ensSettings.online', () => {
  beforeEach(() => {
    mockAsyncGetItem.mockReset();
    mockAsyncSetItem.mockReset();
    mockSecureGetItem.mockReset();
    mockSecureSetItem.mockReset();
  });

  it('DEFAULT_ENS_RPC_URL is PublicNode', () => {
    expect(DEFAULT_ENS_RPC_URL).toBe('https://ethereum-rpc.publicnode.com');
  });

  describe('loadEnsSettings', () => {
    it('returns enabled=false and empty rpcUrl when nothing stored', async () => {
      mockAsyncGetItem.mockResolvedValue(null);
      mockSecureGetItem.mockResolvedValue(null);
      expect(await loadEnsSettings()).toEqual({ enabled: false, rpcUrl: '' });
    });

    it('returns enabled=true and stored URL', async () => {
      mockAsyncGetItem.mockResolvedValue('true');
      mockSecureGetItem.mockResolvedValue('https://custom.rpc');
      expect(await loadEnsSettings()).toEqual({
        enabled: true,
        rpcUrl: 'https://custom.rpc',
      });
    });

    it('returns enabled=false when flag is not "true"', async () => {
      mockAsyncGetItem.mockResolvedValue('false');
      mockSecureGetItem.mockResolvedValue('https://custom.rpc');
      expect(await loadEnsSettings()).toEqual({
        enabled: false,
        rpcUrl: 'https://custom.rpc',
      });
    });

    it('returns defaults when storage throws', async () => {
      mockAsyncGetItem.mockRejectedValue(new Error('storage failure'));
      mockSecureGetItem.mockRejectedValue(new Error('storage failure'));
      expect(await loadEnsSettings()).toEqual({ enabled: false, rpcUrl: '' });
    });
  });

  describe('saveEnsEnabled', () => {
    it('stores "true" in AsyncStorage when enabled', async () => {
      mockAsyncSetItem.mockResolvedValue(undefined);
      await saveEnsEnabled(true);
      expect(mockAsyncSetItem).toHaveBeenCalledWith('ens_enabled', 'true');
      expect(mockSecureSetItem).not.toHaveBeenCalled();
    });

    it('stores "false" in AsyncStorage when disabled', async () => {
      mockAsyncSetItem.mockResolvedValue(undefined);
      await saveEnsEnabled(false);
      expect(mockAsyncSetItem).toHaveBeenCalledWith('ens_enabled', 'false');
      expect(mockSecureSetItem).not.toHaveBeenCalled();
    });
  });

  describe('saveEnsRpcUrl', () => {
    it('stores the URL in EncryptedStorage', async () => {
      mockSecureSetItem.mockResolvedValue(undefined);
      await saveEnsRpcUrl('https://custom.rpc');
      expect(mockSecureSetItem).toHaveBeenCalledWith(
        'ens_rpc_url',
        'https://custom.rpc',
      );
      expect(mockAsyncSetItem).not.toHaveBeenCalled();
    });

    it('stores empty string', async () => {
      mockSecureSetItem.mockResolvedValue(undefined);
      await saveEnsRpcUrl('');
      expect(mockSecureSetItem).toHaveBeenCalledWith('ens_rpc_url', '');
    });
  });
});

describe('ensSettings.offline', () => {
  beforeEach(() => {
    mockAsyncGetItem.mockReset();
    mockAsyncSetItem.mockReset();
    mockSecureGetItem.mockReset();
    mockSecureSetItem.mockReset();
  });

  it('DEFAULT_ENS_RPC_URL is empty', () => {
    expect(DEFAULT_OFFLINE).toBe('');
  });

  it('loadEnsSettings returns disabled with empty URL', async () => {
    expect(await loadSettingsOffline()).toEqual({ enabled: false, rpcUrl: '' });
    expect(mockAsyncGetItem).not.toHaveBeenCalled();
    expect(mockSecureGetItem).not.toHaveBeenCalled();
  });

  it('saveEnsEnabled is a no-op', async () => {
    await saveEnabledOffline(true);
    expect(mockAsyncSetItem).not.toHaveBeenCalled();
    expect(mockSecureSetItem).not.toHaveBeenCalled();
  });

  it('saveEnsRpcUrl is a no-op', async () => {
    await saveOffline('https://any.rpc');
    expect(mockAsyncSetItem).not.toHaveBeenCalled();
    expect(mockSecureSetItem).not.toHaveBeenCalled();
  });
});
