import AsyncStorage from '@react-native-async-storage/async-storage';

const DASHBOARD_KEYCARD_NOTICE_DISMISSED =
  'preference_dashboard_keycard_notice_dismissed';
const PIN_PAD_SCRAMBLE = 'preference_pinpad_scramble';
const TOKEN_IMAGES_ENABLED = 'preference_token_images_enabled';

async function loadBoolean(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function saveBoolean(key: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(key, value ? '1' : '0');
}

export async function loadDashboardKeycardNoticeDismissed(): Promise<boolean> {
  return loadBoolean(DASHBOARD_KEYCARD_NOTICE_DISMISSED);
}

export async function saveDashboardKeycardNoticeDismissed(
  value: boolean,
): Promise<void> {
  return saveBoolean(DASHBOARD_KEYCARD_NOTICE_DISMISSED, value);
}

export async function loadPinPadScramble(): Promise<boolean> {
  return loadBoolean(PIN_PAD_SCRAMBLE);
}

export async function savePinPadScramble(value: boolean): Promise<void> {
  return saveBoolean(PIN_PAD_SCRAMBLE, value);
}

export async function loadTokenImagesEnabled(): Promise<boolean> {
  return loadBoolean(TOKEN_IMAGES_ENABLED);
}

export async function saveTokenImagesEnabled(value: boolean): Promise<void> {
  return saveBoolean(TOKEN_IMAGES_ENABLED, value);
}
