import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/utils/buildConfig', () => ({
  INTERNET_ENABLED: true,
  WC_PROJECT_ID: 'build-time-id',
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

import { loadWCProjectId, saveWCProjectId } from '../src/storage/walletConnect';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadWCProjectId', () => {
  it('returns override when stored', async () => {
    mockGetItem.mockResolvedValue('  custom-id  ');
    expect(await loadWCProjectId()).toBe('custom-id');
  });

  it('returns build-time ID when no override', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await loadWCProjectId()).toBe('build-time-id');
  });

  it('returns build-time ID when override is blank', async () => {
    mockGetItem.mockResolvedValue('   ');
    expect(await loadWCProjectId()).toBe('build-time-id');
  });

  it('returns build-time ID on AsyncStorage error', async () => {
    mockGetItem.mockRejectedValue(new Error('storage error'));
    expect(await loadWCProjectId()).toBe('build-time-id');
  });
});

describe('saveWCProjectId', () => {
  it('trims and stores the id', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await saveWCProjectId('  my-id  ');
    expect(mockSetItem).toHaveBeenCalledWith('wc_project_id_override', 'my-id');
  });
});
