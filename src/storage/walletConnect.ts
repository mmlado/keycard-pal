import AsyncStorage from '@react-native-async-storage/async-storage';

import { WC_PROJECT_ID } from '@/utils/buildConfig';

const WC_PROJECT_ID_OVERRIDE_KEY = 'wc_project_id_override';

export async function loadWCProjectId(): Promise<string> {
  try {
    const override = await AsyncStorage.getItem(WC_PROJECT_ID_OVERRIDE_KEY);
    if (override && override.trim()) {
      return override.trim();
    }
  } catch {
    // fall through to build-time default
  }
  return WC_PROJECT_ID;
}

export async function saveWCProjectId(id: string): Promise<void> {
  await AsyncStorage.setItem(WC_PROJECT_ID_OVERRIDE_KEY, id.trim());
}
