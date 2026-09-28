import { Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useExternalLink } from '../src/hooks/useExternalLink';

let mockConnected = true;
jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
let mockNavReady = true;
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => mockNavReady,
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

const link = {
  url: 'https://example.test/spec',
  title: 'Spec',
  note: 'A note',
};

describe('useExternalLink', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockConnected = true;
    mockNavReady = true;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    (Linking.openURL as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the browser when the phone has a network', async () => {
    const { result } = renderHook(() => useExternalLink(link));

    expect(result.current.opensInBrowser).toBe(true);
    await act(async () => {
      await result.current.open();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(link.url);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the URL as a QR code when there is no network', async () => {
    mockConnected = false;
    const { result } = renderHook(() => useExternalLink(link));

    expect(result.current.opensInBrowser).toBe(false);
    await act(async () => {
      await result.current.open();
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: link.url,
      title: link.title,
      note: link.note,
    });
  });

  it('falls back to the QR code when no app answers the URL', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no handler'));
    const { result } = renderHook(() => useExternalLink(link));

    await act(async () => {
      await result.current.open();
    });

    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: link.url,
      title: link.title,
      note: link.note,
    });
  });

  it('does nothing when the navigator is not ready', async () => {
    mockConnected = false;
    mockNavReady = false;
    const { result } = renderHook(() => useExternalLink(link));

    await act(async () => {
      await result.current.open();
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
