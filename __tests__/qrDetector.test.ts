import { detectWcUri } from '../src/utils/walletConnect/qrDetector.online';

const navigate = jest.fn();
const navigation = { navigate } as any;

beforeEach(() => navigate.mockClear());

describe('detectWcUri', () => {
  it('returns false and does not navigate for non-wc URIs', () => {
    expect(detectWcUri('https://example.com', navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns false for empty string', () => {
    expect(detectWcUri('', navigation)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns true and navigates for wc: URI', () => {
    const uri = 'wc:abc123@2?relay-protocol=irn';
    expect(detectWcUri(uri, navigation)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('WalletConnectPairing', { uri });
  });

  it('is case-insensitive for the wc: prefix', () => {
    const uri = 'WC:abc123@2?relay-protocol=irn';
    expect(detectWcUri(uri, navigation)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('WalletConnectPairing', { uri });
  });
});
