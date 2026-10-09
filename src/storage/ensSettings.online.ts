import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

export { DEFAULT_ENS_RPC_URL } from '../constants/ens';

const ENS_ENABLED_KEY = 'ens_enabled';
const ENS_RPC_URL_KEY = 'ens_rpc_url';

export interface EnsSettings {
  enabled: boolean;
  rpcUrl: string;
}

export async function loadEnsSettings(): Promise<EnsSettings> {
  try {
    const [enabled, url] = await Promise.all([
      AsyncStorage.getItem(ENS_ENABLED_KEY),
      EncryptedStorage.getItem(ENS_RPC_URL_KEY),
    ]);
    return {
      // '1' is the loadBoolean convention (preferencesStorage); 'true' is
      // accepted for values persisted before this module adopted it.
      enabled: enabled === '1' || enabled === 'true',
      rpcUrl: url?.trim() ?? '',
    };
  } catch {
    return { enabled: false, rpcUrl: '' };
  }
}

export async function saveEnsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENS_ENABLED_KEY, enabled ? '1' : '0');
}

export async function saveEnsRpcUrl(url: string): Promise<void> {
  await EncryptedStorage.setItem(ENS_RPC_URL_KEY, url);
}
