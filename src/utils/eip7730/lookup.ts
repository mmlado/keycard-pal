import {
  BUNDLED_REGISTRY,
  clearSavedIndex,
  loadManifest,
  loadSlice,
  saveIndex,
  type IndexSource,
} from '@/storage/eip7730Index';

import { BUNDLED_ATTESTATIONS } from './knownAttestations';
import {
  indexedFormat,
  isEmptyIndex,
  processRegistryZip,
  sliceName,
  type Eip7730DisplayFormat,
  type Eip7730Index,
  type Eip7730IndexSlice,
} from './zip';

export type SavedIndex = { generatedAt: string; source?: IndexSource };

export type AdoptResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'unsaved'; message: string };

/** Answers at once from the bundled index or a slice already read, else once the slice is read. */
export type FormatLookup =
  | Eip7730DisplayFormat
  | null
  | Promise<Eip7730DisplayFormat | null>;

// An external store, written outside React by adoptRegistry, the restore and the revert.
let saved: SavedIndex | null = null;
let bundled: Eip7730Index | null = null;
const slices = new Map<string, Eip7730IndexSlice | null>();
const reading = new Map<string, Promise<Eip7730IndexSlice | null>>();
const listeners = new Set<() => void>();

export function setSavedIndex(next: SavedIndex | null): void {
  saved = next;
  slices.clear();
  reading.clear();
  listeners.forEach(listener => listener());
}

export function getSavedIndex(): SavedIndex | null {
  return saved;
}

export function subscribeSavedIndex(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Each change moves the saved folder and the active source together, so none may interleave.
let changing: Promise<unknown> = Promise.resolve();
function oneChangeAtATime<T>(change: () => Promise<T>): Promise<T> {
  const next = changing.then(change, change);
  changing = next.catch(() => undefined);
  return next;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function adoptRegistry(
  bytes: Uint8Array,
  source: IndexSource,
): Promise<AdoptResult> {
  let index: Eip7730Index;
  try {
    // Skips recovering the signatures the bundled index verified: 13 s on a phone.
    index = processRegistryZip(bytes, { verified: BUNDLED_ATTESTATIONS });
  } catch (e) {
    return { ok: false, reason: 'invalid', message: messageOf(e) };
  }
  if (isEmptyIndex(index)) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'The file has no descriptors this app can read.',
    };
  }
  return oneChangeAtATime(async (): Promise<AdoptResult> => {
    try {
      const { generatedAt } = await saveIndex(index, source);
      setSavedIndex({ generatedAt, source });
      return { ok: true };
    } catch (e) {
      // A save that failed after removing the old folder leaves nothing to read.
      if (saved && !(await loadManifest())) setSavedIndex(null);
      return { ok: false, reason: 'unsaved', message: messageOf(e) };
    }
  });
}

let restoring: Promise<void> | null = null;

// One read per app run, shared by both builds; the online download waits on it.
export function restorePersistedIndex(): Promise<void> {
  if (!restoring) {
    restoring = oneChangeAtATime(async () => {
      // An adoption that ran first already set it.
      if (saved) return;
      const manifest = await loadManifest();
      if (!manifest) return;
      // An app update brought another registry. Not by date: an offline phone's clock can be anything.
      if (manifest.bundled !== BUNDLED_REGISTRY) {
        await clearSavedIndex();
        return;
      }
      setSavedIndex({
        generatedAt: manifest.generatedAt,
        source: manifest.source,
      });
    });
  }
  return restoring;
}

export function revertToBundledIndex(): Promise<void> {
  return oneChangeAtATime(async () => {
    await clearSavedIndex();
    setSavedIndex(null);
  });
}

function bundledIndex(): Eip7730Index {
  // Required here, not imported: with a saved index the bundled one is never built.
  if (!bundled) bundled = require('@/data/eip7730.json') as Eip7730Index;
  return bundled;
}

function fromActive(
  address: string,
  read: (source: Eip7730IndexSlice) => Eip7730DisplayFormat | null,
): FormatLookup {
  if (!saved) return read(bundledIndex());
  const name = sliceName(address);
  if (slices.has(name)) {
    const slice = slices.get(name);
    return slice ? read(slice) : null;
  }
  let pending = reading.get(name);
  if (!pending) {
    const source = saved;
    pending = loadSlice(name).then(slice => {
      // A slice of a source replaced meanwhile must not be cached for the new one.
      if (saved === source) slices.set(name, slice);
      return slice;
    });
    reading.set(name, pending);
  }
  return pending.then(slice => (slice ? read(slice) : null));
}

export function lookupCalldata(
  chainId: number,
  contractAddress: string,
  selector: string,
): FormatLookup {
  if (!Number.isFinite(chainId) || !contractAddress || !selector) return null;
  const address = contractAddress.toLowerCase();
  return fromActive(address, source =>
    indexedFormat(
      source,
      'contracts',
      chainId,
      address,
      selector.toLowerCase(),
    ),
  );
}

function domainMatches(
  required: Record<string, string> | undefined,
  domain: Record<string, unknown>,
): boolean {
  if (!required) return true;
  return Object.entries(required).every(
    ([key, value]) =>
      domain[key] !== undefined && String(domain[key]) === value,
  );
}

// The spec keys EIP-712 formats by `encodeType`, never by the bare primary type.
export function lookupEip712(
  chainId: number,
  verifyingContract: string,
  encodedType: string,
  domain: Record<string, unknown>,
): FormatLookup {
  if (!Number.isFinite(chainId) || !verifyingContract || !encodedType)
    return null;
  const address = verifyingContract.toLowerCase();
  return fromActive(address, source => {
    const format = indexedFormat(
      source,
      'eip712',
      chainId,
      address,
      encodedType,
    );
    return format && domainMatches(format.domain, domain) ? format : null;
  });
}
