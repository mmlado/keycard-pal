import AsyncStorage from '@react-native-async-storage/async-storage';

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
      AsyncStorage.getItem(ENS_RPC_URL_KEY),
    ]);
    return {
      enabled: enabled === 'true',
      rpcUrl: url?.trim() ?? '',
    };
  } catch {
    return { enabled: false, rpcUrl: '' };
  }
}

export async function loadEnsRpcUrl(): Promise<string | null> {
  try {
    const [enabled, url] = await Promise.all([
      AsyncStorage.getItem(ENS_ENABLED_KEY),
      AsyncStorage.getItem(ENS_RPC_URL_KEY),
    ]);
    if (enabled !== 'true') return null;
    return url?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveEnsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function saveEnsRpcUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(ENS_RPC_URL_KEY, url);
}
