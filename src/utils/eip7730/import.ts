import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

import {
  loadIndexedAt,
  savePersistedIndex,
  saveIndexedAt,
} from '@/storage/eip7730Index';

import { setRuntimeIndex } from './lookup';
import { processLedgerRegistryZip } from './zip';

import type { Eip7730Index } from './zip';

export type ImportResult =
  | { ok: true; index: Eip7730Index; indexedAt: string }
  | { ok: false; reason: 'cancelled' | 'invalid' | 'unreadable' };

function base64ToBytes(b64: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function importLedgerRegistryZipFromPicker(): Promise<ImportResult> {
  let result;
  try {
    result = await pick({ type: [types.zip, 'application/zip'] });
  } catch {
    return { ok: false, reason: 'cancelled' };
  }
  const file = Array.isArray(result) ? result[0] : result;
  if (!file?.uri) return { ok: false, reason: 'cancelled' };

  let bytes: Uint8Array;
  try {
    const b64 = await RNFS.readFile(file.uri, 'base64');
    bytes = base64ToBytes(b64);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  let index: Eip7730Index;
  try {
    index = processLedgerRegistryZip(bytes);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const indexedAt = new Date().toISOString();
  await savePersistedIndex(index);
  await saveIndexedAt(indexedAt);
  setRuntimeIndex(index);
  return { ok: true, index, indexedAt };
}

export async function getLastIndexedAt(): Promise<string | null> {
  return loadIndexedAt();
}
