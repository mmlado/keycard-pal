import { DEFAULT_EIP7730_REGISTRY_URL } from '@/constants/eip7730';

export type Eip7730DescriptorSource = 'auto' | 'manual';

export async function loadDescriptorSource(): Promise<Eip7730DescriptorSource> {
  return 'manual';
}

export async function saveDescriptorSource(
  _source: Eip7730DescriptorSource,
): Promise<void> {
  // offline build: no-op
}

export async function loadDescriptorUrl(): Promise<string> {
  return DEFAULT_EIP7730_REGISTRY_URL;
}

export async function saveDescriptorUrl(_url: string): Promise<void> {
  // offline build: no-op
}

export async function loadWifiOnly(): Promise<boolean> {
  return false;
}

export async function saveWifiOnly(_wifiOnly: boolean): Promise<void> {
  // offline build: no-op
}

export async function loadEtag(): Promise<string | null> {
  return null;
}

export async function saveEtag(_etag: string): Promise<void> {
  // offline build: no-op
}

export async function clearEtag(): Promise<void> {
  // offline build: no-op
}

export async function loadLastModified(): Promise<string | null> {
  return null;
}

export async function saveLastModified(_lastModified: string): Promise<void> {
  // offline build: no-op
}

export async function clearLastModified(): Promise<void> {
  // offline build: no-op
}
