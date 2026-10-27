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

import { isOnWifi } from '@/utils/connectivity.online';
import {
  adoptRegistry,
  getSavedIndex,
  restorePersistedIndex,
} from '@/utils/eip7730/lookup';

import {
  Eip7730Context,
  type Eip7730DownloadPhase,
  type Eip7730DownloadState,
} from './context';

const WIFI_ONLY_BLOCKED =
  'Not on Wi-Fi, nothing downloaded. Turn off "Download on Wi-Fi only" to use mobile data.';

function asString(headerValue: string | null | undefined): string | null {
  return typeof headerValue === 'string' && headerValue.length > 0
    ? headerValue
    : null;
}

// A registry zip is a few MB. Past these limits the server, or the URL, is wrong.
const MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const NOT_HTTPS = 'The registry zip URL must start with https://.';
const TOO_LARGE = 'The file is larger than any registry zip.';
const TOO_SLOW = 'The download took too long. Try again.';

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
  if (!/^https:\/\//i.test(url)) throw new Error(NOT_HTTPS);
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;

  // React Native's fetch has no timeout of its own, so a stalled server would hold the download.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers,
      // React Native types RequestInit with its own AbortSignal; the object is the same.
      signal: controller.signal as RequestInit['signal'],
    });
    if (res.status === 304) return { status: 'not-modified' };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLengthHeader = res.headers.get('content-length');
    const total = contentLengthHeader ? Number(contentLengthHeader) : 0;
    if (total > MAX_DOWNLOAD_BYTES) throw new Error(TOO_LARGE);
    const validators = {
      etag: asString(res.headers.get('etag')),
      lastModified: asString(res.headers.get('last-modified')),
    };

    const body = (
      res as unknown as { body?: ReadableStream<Uint8Array> | null }
    ).body;
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
          if (received > MAX_DOWNLOAD_BYTES) throw new Error(TOO_LARGE);
          if (total > 0) onProgress(Math.min(received / total, 1));
        }
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return { status: 'ok', bytes: merged, ...validators };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_DOWNLOAD_BYTES) throw new Error(TOO_LARGE);
    onProgress(1);
    return { status: 'ok', bytes: new Uint8Array(buf), ...validators };
  } catch (e) {
    if (controller.signal.aborted) throw new Error(TOO_SLOW);
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
  const startedRef = useRef(false);

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
      if (wifiOnly && !(await isOnWifi())) {
        setError(WIFI_ONLY_BLOCKED);
        setPhase('error');
        return;
      }

      setPhase('checking');
      const url = await loadDescriptorUrl();
      // The validators describe the saved index; without one a 304 would leave the bundled one.
      const conditional = !options.force && getSavedIndex() !== null;
      const etag = conditional ? await loadEtag() : null;
      const lastModified = conditional ? await loadLastModified() : null;

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
      const adopted = await adoptRegistry(result.bytes, 'download');
      if (!adopted.ok) throw new Error(adopted.message);
      if (result.etag) await saveEtag(result.etag);
      if (result.lastModified) await saveLastModified(result.lastModified);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    restorePersistedIndex().then(() => run({ force: false }));
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
