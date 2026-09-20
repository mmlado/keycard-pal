import type { NavigationProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';
import { loadWCProjectId } from '@/storage/walletConnect';

let projectIdSet = false;

/** A local read, no network. The scanner runs it on focus, before any code arrives. */
export async function refreshWcDetection(): Promise<void> {
  projectIdSet = Boolean(await loadWCProjectId());
}

export function detectWcUri(
  value: string,
  navigation: NavigationProp<RootStackParamList>,
): boolean {
  // Without a Project ID WalletConnect cannot work, so a wc: code is not acted on.
  if (!projectIdSet || !value.toLowerCase().startsWith('wc:')) {
    return false;
  }
  navigation.navigate('WalletConnectPairing', { uri: value });
  return true;
}
