import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_EIP7730_REGISTRY_URL } from '@/constants/eip7730';

export type Eip7730DescriptorSource = 'auto' | 'manual';

const SOURCE_KEY = 'eip7730_source';
const URL_KEY = 'eip7730_url';
const WIFI_ONLY_KEY = 'eip7730_wifi_only';
const ETAG_KEY = 'eip7730_etag';
const LAST_MODIFIED_KEY = 'eip7730_last_modified';

async function loadString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function saveString(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function loadDescriptorSource(): Promise<Eip7730DescriptorSource> {
  return (await loadString(SOURCE_KEY)) === 'auto' ? 'auto' : 'manual';
}

export async function saveDescriptorSource(
  source: Eip7730DescriptorSource,
): Promise<void> {
  await saveString(SOURCE_KEY, source);
}

export async function loadDescriptorUrl(): Promise<string> {
  const value = await loadString(URL_KEY);
  return value?.trim() ? value.trim() : DEFAULT_EIP7730_REGISTRY_URL;
}

export async function saveDescriptorUrl(url: string): Promise<void> {
  await saveString(URL_KEY, url);
}

export async function loadWifiOnly(): Promise<boolean> {
  return (await loadString(WIFI_ONLY_KEY)) === '1';
}

export async function saveWifiOnly(wifiOnly: boolean): Promise<void> {
  await saveString(WIFI_ONLY_KEY, wifiOnly ? '1' : '0');
}

export async function loadEtag(): Promise<string | null> {
  return loadString(ETAG_KEY);
}

export async function saveEtag(etag: string): Promise<void> {
  await saveString(ETAG_KEY, etag);
}

export async function clearEtag(): Promise<void> {
  await AsyncStorage.removeItem(ETAG_KEY);
}

export async function loadLastModified(): Promise<string | null> {
  return loadString(LAST_MODIFIED_KEY);
}

export async function saveLastModified(lastModified: string): Promise<void> {
  await saveString(LAST_MODIFIED_KEY, lastModified);
}

export async function clearLastModified(): Promise<void> {
  await AsyncStorage.removeItem(LAST_MODIFIED_KEY);
}
