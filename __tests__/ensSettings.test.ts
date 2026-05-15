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

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockGetItem(...args),
    setItem: (...args: any[]) => mockSetItem(...args),
  },
}));

describe('ensSettings.online', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it('DEFAULT_ENS_RPC_URL is PublicNode', () => {
    expect(DEFAULT_ENS_RPC_URL).toBe('https://ethereum-rpc.publicnode.com');
  });

  describe('loadEnsSettings', () => {
    it('returns enabled=false and empty rpcUrl when nothing stored', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await loadEnsSettings()).toEqual({ enabled: false, rpcUrl: '' });
    });

    it('returns enabled=true and stored URL', async () => {
      mockGetItem
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('https://custom.rpc');
      expect(await loadEnsSettings()).toEqual({
        enabled: true,
        rpcUrl: 'https://custom.rpc',
      });
    });

    it('returns enabled=false when flag is not "true"', async () => {
      mockGetItem
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce('https://custom.rpc');
      expect(await loadEnsSettings()).toEqual({
        enabled: false,
        rpcUrl: 'https://custom.rpc',
      });
    });

    it('returns defaults when storage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('storage failure'));
      expect(await loadEnsSettings()).toEqual({ enabled: false, rpcUrl: '' });
    });
  });

  describe('saveEnsEnabled', () => {
    it('stores "true" when enabled', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveEnsEnabled(true);
      expect(mockSetItem).toHaveBeenCalledWith('ens_enabled', 'true');
    });

    it('stores "false" when disabled', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveEnsEnabled(false);
      expect(mockSetItem).toHaveBeenCalledWith('ens_enabled', 'false');
    });
  });

  describe('saveEnsRpcUrl', () => {
    it('stores the URL', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveEnsRpcUrl('https://custom.rpc');
      expect(mockSetItem).toHaveBeenCalledWith(
        'ens_rpc_url',
        'https://custom.rpc',
      );
    });

    it('stores empty string', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveEnsRpcUrl('');
      expect(mockSetItem).toHaveBeenCalledWith('ens_rpc_url', '');
    });
  });
});

describe('ensSettings.offline', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it('DEFAULT_ENS_RPC_URL is empty', () => {
    expect(DEFAULT_OFFLINE).toBe('');
  });

  it('loadEnsSettings returns disabled with empty URL', async () => {
    expect(await loadSettingsOffline()).toEqual({ enabled: false, rpcUrl: '' });
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('saveEnsEnabled is a no-op', async () => {
    await saveEnabledOffline(true);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('saveEnsRpcUrl is a no-op', async () => {
    await saveOffline('https://any.rpc');
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
