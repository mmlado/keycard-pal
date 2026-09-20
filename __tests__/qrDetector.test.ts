import {
  detectWcUri,
  refreshWcDetection,
} from '../src/utils/walletConnect/qrDetector.online';
import * as offline from '../src/utils/walletConnect/qrDetector.offline';

const mockLoadWCProjectId = jest.fn();

jest.mock('../src/storage/walletConnect', () => ({
  loadWCProjectId: () => mockLoadWCProjectId(),
}));

const navigate = jest.fn();
const navigation = { navigate } as any;
const WC_URI = 'wc:abc123@2?relay-protocol=irn&symKey=xyz';

beforeEach(() => navigate.mockClear());

describe('detectWcUri with a Project ID set', () => {
  beforeEach(async () => {
    mockLoadWCProjectId.mockResolvedValue('project-id');
    await refreshWcDetection();
  });

  it('returns false and does not navigate for non-wc URIs', () => {
    expect(detectWcUri('ur:eth-sign-request/abc', navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns false for empty string', () => {
    expect(detectWcUri('', navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns true and navigates for wc: URI', () => {
    expect(detectWcUri(WC_URI, navigation)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('WalletConnectPairing', {
      uri: WC_URI,
    });
  });

  it('is case-insensitive for the wc: prefix', () => {
    expect(detectWcUri('WC:abc123@2', navigation)).toBe(true);
    expect(navigate).toHaveBeenCalled();
  });
});

describe('detectWcUri without a Project ID', () => {
  it('does not act on a wc: URI', async () => {
    mockLoadWCProjectId.mockResolvedValue('');
    await refreshWcDetection();

    expect(detectWcUri(WC_URI, navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('acts again once a Project ID has been saved', async () => {
    mockLoadWCProjectId.mockResolvedValue('');
    await refreshWcDetection();
    expect(detectWcUri(WC_URI, navigation)).toBe(false);

    mockLoadWCProjectId.mockResolvedValue('project-id');
    await refreshWcDetection();
    expect(detectWcUri(WC_URI, navigation)).toBe(true);
  });
});

describe('offline stub', () => {
  it('never acts on a wc: URI', async () => {
    await offline.refreshWcDetection();
    expect(offline.detectWcUri(WC_URI, navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
