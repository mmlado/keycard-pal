import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

export type TenderlyCredentials = {
  accountSlug: string;
  projectSlug: string;
  apiKey: string;
};

export interface TenderlyConfig {
  enabled: boolean;
  credentials: TenderlyCredentials;
}

const TENDERLY_ENABLED_KEY = 'tenderly_enabled';
const TENDERLY_ACCOUNT_SLUG_KEY = 'tenderly_account_slug';
const TENDERLY_PROJECT_SLUG_KEY = 'tenderly_project_slug';
const TENDERLY_API_KEY_KEY = 'tenderly_api_key';

export async function loadTenderlyConfig(): Promise<TenderlyConfig> {
  try {
    const [enabled, accountSlug, projectSlug, apiKey] = await Promise.all([
      AsyncStorage.getItem(TENDERLY_ENABLED_KEY),
      EncryptedStorage.getItem(TENDERLY_ACCOUNT_SLUG_KEY),
      EncryptedStorage.getItem(TENDERLY_PROJECT_SLUG_KEY),
      EncryptedStorage.getItem(TENDERLY_API_KEY_KEY),
    ]);
    return {
      enabled: enabled === 'true',
      credentials: {
        accountSlug: accountSlug?.trim() ?? '',
        projectSlug: projectSlug?.trim() ?? '',
        apiKey: apiKey?.trim() ?? '',
      },
    };
  } catch {
    return {
      enabled: false,
      credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
    };
  }
}

export async function saveTenderlyEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(TENDERLY_ENABLED_KEY, value ? 'true' : 'false');
}

export async function saveTenderlyCredentials(
  c: TenderlyCredentials,
): Promise<void> {
  await Promise.all([
    EncryptedStorage.setItem(TENDERLY_ACCOUNT_SLUG_KEY, c.accountSlug),
    EncryptedStorage.setItem(TENDERLY_PROJECT_SLUG_KEY, c.projectSlug),
    EncryptedStorage.setItem(TENDERLY_API_KEY_KEY, c.apiKey),
  ]);
}
