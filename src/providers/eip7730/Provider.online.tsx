import NetInfo from '@react-native-community/netinfo';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  loadDescriptorSource,
  loadDescriptorUrl,
  loadEtag,
  loadLastModified,
  loadWifiOnly,
  saveEtag,
  saveLastModified,
} from '@/storage/eip7730Settings.online';
import {
  loadPersistedIndex,
  savePersistedIndex,
  saveIndexedAt,
} from '@/storage/eip7730Index';

import { setRuntimeIndex } from '@/utils/eip7730/lookup';
import { processLedgerRegistryZip } from '@/utils/eip7730/zip';

import {
  Eip7730Context,
  type Eip7730DownloadPhase,
  type Eip7730DownloadState,
} from './context';

async function networkAllowed(wifiOnly: boolean): Promise<boolean> {
  if (!wifiOnly) return true;
  try {
    const state = await NetInfo.fetch();
    return state.type === 'wifi';
  } catch {
    return true;
  }
}

function asString(headerValue: string | null | undefined): string | null {
  return typeof headerValue === 'string' && headerValue.length > 0
    ? headerValue
    : null;
}

async function downloadZip(
  url: string,
  etag: string | null,
  lastModified: string | null,
  onProgress: (progress: number) => void,
): Promise<
  | { status: 'not-modified' }
  | {
      status: 'ok';
      bytes: Uint8Array;
      etag: string | null;
      lastModified: string | null;
    }
> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;

  const res = await fetch(url, { headers });
  if (res.status === 304) return { status: 'not-modified' };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLengthHeader = res.headers.get('content-length');
  const total = contentLengthHeader ? Number(contentLengthHeader) : 0;

  const body = (res as unknown as { body?: ReadableStream<Uint8Array> | null })
    .body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        if (total > 0) onProgress(Math.min(received / total, 1));
      }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return {
      status: 'ok',
      bytes: merged,
      etag: asString(res.headers.get('etag')),
      lastModified: asString(res.headers.get('last-modified')),
    };
  }

  const buf = await res.arrayBuffer();
  onProgress(1);
  return {
    status: 'ok',
    bytes: new Uint8Array(buf),
    etag: asString(res.headers.get('etag')),
    lastModified: asString(res.headers.get('last-modified')),
  };
}

export function Eip7730DownloadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Eip7730DownloadPhase>('idle');
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const runningRef = useRef(false);
  const persistedLoadedRef = useRef(false);

  const run = useCallback(async (options: { force?: boolean }) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(undefined);
    setProgress(undefined);

    try {
      const source = await loadDescriptorSource();
      if (source !== 'auto' && !options.force) {
        setPhase('idle');
        return;
      }
      const wifiOnly = await loadWifiOnly();
      if (!(await networkAllowed(wifiOnly))) {
        setPhase('idle');
        return;
      }

      setPhase('checking');
      const url = await loadDescriptorUrl();
      const etag = options.force ? null : await loadEtag();
      const lastModified = options.force ? null : await loadLastModified();

      setPhase('downloading');
      const result = await downloadZip(url, etag, lastModified, p =>
        setProgress(p),
      );

      if (result.status === 'not-modified') {
        setPhase('done');
        return;
      }

      setPhase('processing');
      setProgress(undefined);
      const index = processLedgerRegistryZip(result.bytes);
      await savePersistedIndex(index);
      const indexedAt = new Date().toISOString();
      await saveIndexedAt(indexedAt);
      if (result.etag) await saveEtag(result.etag);
      if (result.lastModified) await saveLastModified(result.lastModified);
      setRuntimeIndex(index);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (persistedLoadedRef.current) return;
    persistedLoadedRef.current = true;
    let cancelled = false;
    loadPersistedIndex().then(index => {
      if (!cancelled && index) setRuntimeIndex(index);
      run({ force: false });
    });
    return () => {
      cancelled = true;
    };
  }, [run]);

  const triggerDownload = useCallback(() => {
    run({ force: true });
  }, [run]);

  const value = useMemo<Eip7730DownloadState>(
    () => ({ phase, progress, error, triggerDownload }),
    [phase, progress, error, triggerDownload],
  );

  return (
    <Eip7730Context.Provider value={value}>{children}</Eip7730Context.Provider>
  );
}
