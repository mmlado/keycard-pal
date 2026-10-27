import React, { useContext } from 'react';
import { Text, View } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import { Eip7730Context } from '../src/providers/eip7730/context';
import { Eip7730DownloadProvider } from '../src/providers/eip7730/Provider.online';

const mockRestore = jest.fn();
const mockAdopt = jest.fn();
const mockGetSavedIndex = jest.fn();
jest.mock('../src/utils/eip7730/lookup', () => ({
  restorePersistedIndex: (...args: any[]) => mockRestore(...args),
  adoptRegistry: (...args: any[]) => mockAdopt(...args),
  getSavedIndex: () => mockGetSavedIndex(),
}));

const mockLoadSource = jest.fn();
const mockLoadUrl = jest.fn();
const mockLoadWifi = jest.fn();
const mockLoadEtag = jest.fn();
const mockLoadLastModified = jest.fn();
const mockSaveEtag = jest.fn();
const mockSaveLastModified = jest.fn();

jest.mock('../src/storage/eip7730Settings.online', () => ({
  loadDescriptorSource: (...args: any[]) => mockLoadSource(...args),
  loadDescriptorUrl: (...args: any[]) => mockLoadUrl(...args),
  loadWifiOnly: (...args: any[]) => mockLoadWifi(...args),
  loadEtag: (...args: any[]) => mockLoadEtag(...args),
  loadLastModified: (...args: any[]) => mockLoadLastModified(...args),
  saveEtag: (...args: any[]) => mockSaveEtag(...args),
  saveLastModified: (...args: any[]) => mockSaveLastModified(...args),
}));

const mockIsOnWifi = jest.fn();
jest.mock('../src/utils/connectivity.online', () => ({
  isOnWifi: () => mockIsOnWifi(),
}));

const WIFI_ONLY_BLOCKED =
  'Not on Wi-Fi, nothing downloaded. Turn off "Download on Wi-Fi only" to use mobile data.';

function PhaseProbe() {
  const ctx = useContext(Eip7730Context);
  return (
    <View>
      <Text testID="phase">{ctx.phase}</Text>
      <Text testID="error">{ctx.error ?? ''}</Text>
      <Text testID="trigger" onPress={() => ctx.triggerDownload()}>
        go
      </Text>
    </View>
  );
}

function buildResponse({
  status = 200,
  body = new Uint8Array([1, 2, 3]),
  etag = null,
  lastModified = null,
}: {
  status?: number;
  body?: Uint8Array;
  etag?: string | null;
  lastModified?: string | null;
} = {}) {
  const headers = new Map<string, string>();
  if (etag) headers.set('etag', etag);
  if (lastModified) headers.set('last-modified', lastModified);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) ?? null,
    },
    body: null,
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRestore.mockResolvedValue(undefined);
  mockGetSavedIndex.mockReturnValue({
    generatedAt: '2025-01-01T00:00:00.000Z',
  });
  mockAdopt.mockResolvedValue({ ok: true });
  mockLoadSource.mockResolvedValue('manual');
  mockLoadUrl.mockResolvedValue('https://example.test/registry.zip');
  mockLoadWifi.mockResolvedValue(false);
  mockLoadEtag.mockResolvedValue(null);
  mockLoadLastModified.mockResolvedValue(null);
  mockSaveEtag.mockResolvedValue(undefined);
  mockSaveLastModified.mockResolvedValue(undefined);
  mockIsOnWifi.mockResolvedValue(true);
  (global as any).fetch = jest.fn();
});

describe('Eip7730DownloadProvider', () => {
  it('stays idle when source is manual', async () => {
    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('idle');
    });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('downloads and processes when source is auto', async () => {
    mockLoadSource.mockResolvedValue('auto');
    (global as any).fetch.mockResolvedValue(buildResponse({ etag: 'W/abc' }));

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://example.test/registry.zip',
      expect.objectContaining({ headers: {} }),
    );
    expect(mockAdopt).toHaveBeenCalledWith(expect.any(Uint8Array), 'download');
    expect(mockSaveEtag).toHaveBeenCalledWith('W/abc');
  });

  it('keeps the current index when the download has no descriptors', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockAdopt.mockResolvedValue({
      ok: false,
      reason: 'invalid',
      message: 'The file has no descriptors this app can read.',
    });
    (global as any).fetch.mockResolvedValue(buildResponse({ etag: 'W/new' }));

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
    expect(screen.getByTestId('error').children[0]).toBe(
      'The file has no descriptors this app can read.',
    );
    expect(mockSaveEtag).not.toHaveBeenCalled();
  });

  it('skips processing when server returns 304', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockLoadEtag.mockResolvedValue('W/old');
    (global as any).fetch.mockResolvedValue(buildResponse({ status: 304 }));

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://example.test/registry.zip',
      expect.objectContaining({ headers: { 'If-None-Match': 'W/old' } }),
    );
    expect(mockAdopt).not.toHaveBeenCalled();
  });

  it('downloads in full when no saved index was restored, whatever the stored ETag', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockGetSavedIndex.mockReturnValue(null);
    mockLoadEtag.mockResolvedValue('W/old');
    mockLoadLastModified.mockResolvedValue('Sat, 10 Oct 2026 00:00:00 GMT');
    (global as any).fetch.mockResolvedValue(buildResponse());

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect((global as any).fetch).toHaveBeenCalledWith(
      'https://example.test/registry.zip',
      expect.objectContaining({ headers: {} }),
    );
    expect(mockAdopt).toHaveBeenCalledWith(expect.any(Uint8Array), 'download');
  });

  it('says why when Wi-Fi only blocks the download', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockLoadWifi.mockResolvedValue(true);
    mockIsOnWifi.mockResolvedValue(false);

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
    expect(screen.getByTestId('error').children[0]).toBe(WIFI_ONLY_BLOCKED);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('keeps Wi-Fi only for Download now too', async () => {
    mockLoadWifi.mockResolvedValue(true);
    mockIsOnWifi.mockResolvedValue(false);

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalled();
    });
    await act(async () => {
      screen.getByTestId('trigger').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').children[0]).toBe(WIFI_ONLY_BLOCKED);
    });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('clears the Wi-Fi message on the next attempt', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockLoadWifi.mockResolvedValue(true);
    mockIsOnWifi.mockResolvedValue(false);
    (global as any).fetch.mockResolvedValue(buildResponse());

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('error').children[0]).toBe(WIFI_ONLY_BLOCKED);
    });

    mockIsOnWifi.mockResolvedValue(true);
    await act(async () => {
      screen.getByTestId('trigger').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect(screen.queryByText(WIFI_ONLY_BLOCKED)).toBeNull();
  });

  it('triggerDownload forces a download even when source is manual', async () => {
    (global as any).fetch.mockResolvedValue(buildResponse());

    function TriggerProbe() {
      const ctx = useContext(Eip7730Context);
      return (
        <View>
          <Text testID="phase">{ctx.phase}</Text>
          <Text testID="trigger" onPress={() => ctx.triggerDownload()}>
            go
          </Text>
        </View>
      );
    }
    render(
      <Eip7730DownloadProvider>
        <TriggerProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalled();
    });
    // initial run: manual -> idle, no fetch
    expect((global as any).fetch).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByTestId('trigger').props.onPress();
    });

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
    });
  });

  it('reports error phase when fetch fails', async () => {
    mockLoadSource.mockResolvedValue('auto');
    (global as any).fetch.mockRejectedValue(new Error('boom'));

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
  });

  it('reads a streamed body in chunks and keeps Last-Modified', async () => {
    mockLoadSource.mockResolvedValue('auto');
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])];
    const headers: Record<string, string> = {
      'content-length': '3',
      'last-modified': 'Sat, 10 Oct 2026 00:00:00 GMT',
    };
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      body: {
        getReader: () => ({
          read: async () =>
            chunks.length > 0
              ? { value: chunks.shift(), done: false }
              : { value: undefined, done: true },
        }),
      },
    });

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect(Array.from(mockAdopt.mock.calls[0][0])).toEqual([1, 2, 3]);
    expect(mockSaveLastModified).toHaveBeenCalledWith(
      'Sat, 10 Oct 2026 00:00:00 GMT',
    );
  });

  it('downloads on any network when Wi-Fi only is off', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockIsOnWifi.mockResolvedValue(false);
    (global as any).fetch.mockResolvedValue(buildResponse());

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect(mockIsOnWifi).not.toHaveBeenCalled();
  });

  it('refuses a registry URL that is not https', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockLoadUrl.mockResolvedValue('http://example.test/registry.zip');
    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
    expect(screen.getByTestId('error').children[0]).toBe(
      'The registry zip URL must start with https://.',
    );
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('refuses a download larger than any registry zip', async () => {
    mockLoadSource.mockResolvedValue('auto');
    (global as any).fetch.mockResolvedValue({
      ...buildResponse(),
      headers: {
        get: (k: string) =>
          k.toLowerCase() === 'content-length'
            ? String(64 * 1024 * 1024)
            : null,
      },
    });
    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
    expect(screen.getByTestId('error').children[0]).toBe(
      'The file is larger than any registry zip.',
    );
    expect(mockAdopt).not.toHaveBeenCalled();
  });

  it('gives up on a download that never finishes', async () => {
    const timeouts = jest.spyOn(global, 'setTimeout');
    try {
      mockLoadSource.mockResolvedValue('auto');
      (global as any).fetch.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener('abort', () =>
              reject(new Error('Aborted')),
            ),
          ),
      );
      render(
        <Eip7730DownloadProvider>
          <PhaseProbe />
        </Eip7730DownloadProvider>,
      );
      await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
      const giveUp = timeouts.mock.calls.find(
        ([, ms]) => ms === 120_000,
      )?.[0] as () => void;
      expect(screen.getByTestId('phase').children[0]).toBe('downloading');
      act(() => giveUp());
      await waitFor(() => {
        expect(screen.getByTestId('phase').children[0]).toBe('error');
      });
      expect(screen.getByTestId('error').children[0]).toBe(
        'The download took too long. Try again.',
      );
    } finally {
      timeouts.mockRestore();
    }
  });

  it('reports an HTTP error status', async () => {
    mockLoadSource.mockResolvedValue('auto');
    (global as any).fetch.mockResolvedValue(buildResponse({ status: 500 }));

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('error');
    });
    expect(mockAdopt).not.toHaveBeenCalled();
  });

  it('waits for the saved index before the first auto-download', async () => {
    mockLoadSource.mockResolvedValue('auto');
    (global as any).fetch.mockResolvedValue(buildResponse());
    let finishRestore: () => void = () => {};
    mockRestore.mockReturnValue(
      new Promise<void>(resolve => {
        finishRestore = resolve;
      }),
    );

    render(
      <Eip7730DownloadProvider>
        <PhaseProbe />
      </Eip7730DownloadProvider>,
    );

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalled();
    });
    expect((global as any).fetch).not.toHaveBeenCalled();

    await act(async () => {
      finishRestore();
    });
    await waitFor(() => {
      expect(screen.getByTestId('phase').children[0]).toBe('done');
    });
    expect((global as any).fetch).toHaveBeenCalled();
  });
});
