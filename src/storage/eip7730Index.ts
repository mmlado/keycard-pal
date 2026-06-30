import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

import type { Eip7730Index } from '@/utils/eip7730/zip';

const INDEX_FILENAME = 'eip7730-index.json';
const INDEXED_AT_KEY = 'eip7730_indexed_at';

function indexPath(): string {
  return `${RNFS.DocumentDirectoryPath}/${INDEX_FILENAME}`;
}

export async function loadPersistedIndex(): Promise<Eip7730Index | null> {
  try {
    const path = indexPath();
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    const text = await RNFS.readFile(path, 'utf8');
    return JSON.parse(text) as Eip7730Index;
  } catch {
    return null;
  }
}

export async function savePersistedIndex(index: Eip7730Index): Promise<void> {
  await RNFS.writeFile(indexPath(), JSON.stringify(index), 'utf8');
}

export async function clearPersistedIndex(): Promise<void> {
  try {
    const path = indexPath();
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {
    // ignore
  }
}

export async function loadIndexedAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(INDEXED_AT_KEY);
  } catch {
    return null;
  }
}

export async function saveIndexedAt(date: string): Promise<void> {
  await AsyncStorage.setItem(INDEXED_AT_KEY, date);
}
