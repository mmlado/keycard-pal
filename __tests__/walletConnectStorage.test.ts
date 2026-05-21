jest.mock('../src/utils/buildConfig', () => ({
  INTERNET_ENABLED: true,
  WC_PROJECT_ID: 'build-time-id',
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

import { loadWCProjectId, saveWCProjectId } from '../src/storage/walletConnect';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadWCProjectId', () => {
  it('returns override when stored', async () => {
    mockSecureGetItem.mockResolvedValue('  custom-id  ');
    expect(await loadWCProjectId()).toBe('custom-id');
  });

  it('returns build-time ID when no override', async () => {
    mockSecureGetItem.mockResolvedValue(null);
    expect(await loadWCProjectId()).toBe('build-time-id');
  });

  it('returns build-time ID when override is blank', async () => {
    mockSecureGetItem.mockResolvedValue('   ');
    expect(await loadWCProjectId()).toBe('build-time-id');
  });

  it('returns build-time ID on EncryptedStorage error', async () => {
    mockSecureGetItem.mockRejectedValue(new Error('storage error'));
    expect(await loadWCProjectId()).toBe('build-time-id');
  });
});

describe('saveWCProjectId', () => {
  it('trims and stores the id in EncryptedStorage', async () => {
    mockSecureSetItem.mockResolvedValue(undefined);
    await saveWCProjectId('  my-id  ');
    expect(mockSecureSetItem).toHaveBeenCalledWith(
      'wc_project_id_override',
      'my-id',
    );
  });
});
