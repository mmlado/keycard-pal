import Keycard from 'keycard-sdk';
import type { Commandset } from 'keycard-sdk/dist/commandset';

import { getKeyUid } from './cardIdentity';
import { pubKeyFingerprint } from './cryptoAccount';

/** One key an export target wants: the path to export and the parent path its fingerprint comes from. */
export type ExportPlanEntry = {
  derivationPath: string;
  parentPath: string;
};

/** An exported key carrying the plan entry it was exported for, so per-key metadata travels with the key. */
export type ExportedKey<E extends ExportPlanEntry = ExportPlanEntry> = {
  entry: E;
  exportRespData: Uint8Array;
  parentFingerprint: number;
};

export type ExportKeysResult<E extends ExportPlanEntry = ExportPlanEntry> = {
  masterFingerprint: number;
  keys: ExportedKey<E>[];
};

/**
 * Keys already exported, for resuming after a tag loss. Bound to the key UID, not the card: the
 * re-tap may be another card or a new seed, and keys of two seeds must never mix. One per
 * prepared flow; never shared or persisted.
 */
export type ExportResumeCache = {
  keyUid: string | null;
  masterFingerprint: number | null;
  parentFingerprints: Map<string, number>;
  keys: Map<string, ExportedKey>;
};

export function makeExportResumeCache(): ExportResumeCache {
  return {
    keyUid: null,
    masterFingerprint: null,
    parentFingerprints: new Map(),
    keys: new Map(),
  };
}

function fingerprintFromExportResponse(data: Uint8Array): number {
  return pubKeyFingerprint(Keycard.BIP32KeyPair.fromTLV(data).publicKey);
}

/** Reads the master fingerprint once and each parent once, then every planned key. A cache skips what was already fetched. */
export async function exportKeysForTarget<E extends ExportPlanEntry>(
  cmdSet: Commandset,
  entries: readonly E[],
  setStatus: (s: string) => void = () => {},
  cache?: ExportResumeCache,
): Promise<ExportKeysResult<E>> {
  if (cache) {
    const appInfo = cmdSet.applicationInfo;
    const keyUid = appInfo ? getKeyUid(appInfo) : null;
    if (keyUid === null || cache.keyUid !== keyUid) {
      cache.keyUid = keyUid;
      cache.masterFingerprint = null;
      cache.parentFingerprints.clear();
      cache.keys.clear();
    }
  }

  let masterFingerprint = cache?.masterFingerprint ?? null;
  if (masterFingerprint === null) {
    setStatus('Reading master key...');
    const masterResp = await cmdSet.exportKey(0, true, 'm', false);
    masterResp.checkOK();
    masterFingerprint = fingerprintFromExportResponse(masterResp.data);
    if (cache) {
      cache.masterFingerprint = masterFingerprint;
    }
  }

  const parentFingerprints =
    cache?.parentFingerprints ?? new Map<string, number>();
  parentFingerprints.set('m', masterFingerprint);

  const keys: ExportedKey<E>[] = [];
  for (const [index, entry] of entries.entries()) {
    // Paths are unique within a target and the entry is the same constant, so narrowing to E is safe.
    const cached = cache?.keys.get(entry.derivationPath);
    if (cached) {
      keys.push(cached as ExportedKey<E>);
      continue;
    }

    setStatus(`Exporting key ${index + 1} of ${entries.length}...`);

    let parentFingerprint = parentFingerprints.get(entry.parentPath);
    if (parentFingerprint === undefined) {
      const parentResp = await cmdSet.exportKey(
        0,
        true,
        entry.parentPath,
        false,
      );
      parentResp.checkOK();
      parentFingerprint = fingerprintFromExportResponse(parentResp.data);
      parentFingerprints.set(entry.parentPath, parentFingerprint);
    }

    const resp = await cmdSet.exportExtendedKey(0, entry.derivationPath, false);
    resp.checkOK();
    const key: ExportedKey<E> = {
      entry,
      exportRespData: resp.data,
      parentFingerprint,
    };
    keys.push(key);
    cache?.keys.set(entry.derivationPath, key);
  }

  return { masterFingerprint, keys };
}
