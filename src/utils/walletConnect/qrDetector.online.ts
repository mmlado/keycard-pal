import type { NavigationProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

export function detectWcUri(
  value: string,
  navigation: NavigationProp<RootStackParamList>,
): boolean {
  if (!value.toLowerCase().startsWith('wc:')) {
    return false;
  }
  navigation.navigate('WalletConnectPairing', { uri: value });
  return true;
}
