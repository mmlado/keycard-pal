import { Platform } from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

import { adoptRegistry } from './lookup';

export type ImportResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'invalid' | 'unreadable' | 'unsaved' };

function base64ToBytes(b64: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function importRegistryZipFromPicker(): Promise<ImportResult> {
  const type = [types.zip, 'application/zip'];
  let result;
  try {
    // Only Android's system picker always answers with a link it grants read access to.
    result =
      Platform.OS === 'android'
        ? await pick({ type, mode: 'open' })
        : await pick({ type });
  } catch {
    return { ok: false, reason: 'cancelled' };
  }
  const file = Array.isArray(result) ? result[0] : result;
  if (!file?.uri) return { ok: false, reason: 'cancelled' };

  let bytes: Uint8Array;
  try {
    // react-native-fs reads a path on iOS, and the picker hands back a file URL.
    const source =
      Platform.OS === 'ios'
        ? decodeURIComponent(file.uri.replace(/^file:\/\//, ''))
        : file.uri;
    const b64 = await RNFS.readFile(source, 'base64');
    bytes = base64ToBytes(b64);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const adopted = await adoptRegistry(bytes, 'import');
  return adopted.ok ? { ok: true } : { ok: false, reason: adopted.reason };
}
