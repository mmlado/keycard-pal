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
 * Checkpoint for resuming a multi-key export after a mid-operation tag loss:
 * the session handshake (SELECT, pairing, secure channel, PIN) must re-run on
 * every tap, but exported keys are deterministic reads, so keys fetched before
 * the loss are reused and only the remainder is fetched. Bound to one seed, not
 * one card: the re-tap may be a DIFFERENT card, or the same card after a factory
 * reset with a new seed, and merging keys from two seeds would corrupt the
 * export, so the cache self-invalidates when the key UID changes. Two cards
 * holding the same seed export identical keys, so resuming across them is safe.
 * Create one per prepared flow (screen visit), never share or persist it.
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

/**
 * The generic card-session executor for wallet exports: reads the master
 * fingerprint once, then exports every planned key with its parent
 * fingerprint (parents are fetched once per distinct path). Which keys to
 * export and what UR to build from them is declared by an ExportTarget
 * (see exportTargets.ts). With a cache, a re-run after a tag loss skips
 * everything already fetched from the same card.
 */
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
    // Entries within one target are unique by derivation path, and the cached
    // entry object is the same table constant, so the base-typed cache read is
    // safe to narrow back to E.
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
