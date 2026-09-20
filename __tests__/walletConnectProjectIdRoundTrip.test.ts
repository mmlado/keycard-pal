// A Project ID saved in Settings has to work right away, without a restart. Runs the
// real storage, detector and client modules against an in-memory EncryptedStorage.

const mockStore = new Map<string, string>();
const mockCore = jest.fn();

jest.mock('../src/utils/buildConfig', () => ({
  INTERNET_ENABLED: true,
  WC_PROJECT_ID: '',
}));
jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value);
    },
  },
}));
jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@walletconnect/core', () => ({
  Core: function Core(options: unknown) {
    mockCore(options);
  },
}));
jest.mock('@reown/walletkit', () => ({
  WalletKit: {
    init: async () => ({
      pair: jest.fn().mockResolvedValue(undefined),
      core: {
        relayer: { transportClose: jest.fn().mockResolvedValue(undefined) },
      },
    }),
  },
}));

import { saveWCProjectId } from '../src/storage/walletConnect';
import { wcClient } from '../src/utils/walletConnect/client.online';
import {
  detectWcUri,
  refreshWcDetection,
} from '../src/utils/walletConnect/qrDetector.online';

const WC_URI = 'wc:abc123@2?relay-protocol=irn&symKey=xyz';
const navigate = jest.fn();
const navigation = { navigate } as any;

// What WalletConnectSettingsSection does on Save.
async function saveInSettings(id: string) {
  await saveWCProjectId(id);
  wcClient.resetClient();
}

// What QRScannerScreen does: refresh on focus, then hand each code to the detector.
async function scan() {
  await refreshWcDetection();
  return detectWcUri(WC_URI, navigation);
}

describe('WalletConnect Project ID, from Settings to pairing', () => {
  it('works in one run of the app: no ID, an ID, another ID, none again', async () => {
    expect(await scan()).toBe(false);
    await expect(wcClient.pair(WC_URI)).rejects.toThrow('needs a Project ID');
    expect(mockCore).not.toHaveBeenCalled();

    await saveInSettings('first-id');
    expect(await scan()).toBe(true);
    await wcClient.pair(WC_URI);
    expect(mockCore).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'first-id' }),
    );

    await saveInSettings('second-id');
    await wcClient.pair(WC_URI);
    expect(mockCore).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'second-id' }),
    );
    expect(mockCore).toHaveBeenCalledTimes(2);

    await saveInSettings('');
    expect(await scan()).toBe(false);
    await expect(wcClient.pair(WC_URI)).rejects.toThrow('needs a Project ID');
  });
});
