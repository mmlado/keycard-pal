import EncryptedStorage from 'react-native-encrypted-storage';

import { WC_PROJECT_ID } from '@/utils/buildConfig';

const WC_PROJECT_ID_OVERRIDE_KEY = 'wc_project_id_override';

export async function loadWCProjectId(): Promise<string> {
  try {
    const override = await EncryptedStorage.getItem(WC_PROJECT_ID_OVERRIDE_KEY);
    if (override && override.trim()) {
      return override.trim();
    }
  } catch {
    // fall through to build-time default
  }
  return WC_PROJECT_ID;
}

export async function saveWCProjectId(id: string): Promise<void> {
  await EncryptedStorage.setItem(WC_PROJECT_ID_OVERRIDE_KEY, id.trim());
}
