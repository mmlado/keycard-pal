import AsyncStorage from '@react-native-async-storage/async-storage';

export const preferenceKeys = {
  dashboardKeycardNoticeDismissed:
    'preference_dashboard_keycard_notice_dismissed',
  pinPadScramble: 'preference_pinpad_scramble',
} as const;

export async function loadBooleanPreference(key: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value === '1';
  } catch {
    return false;
  }
}

export async function saveBooleanPreference(
  key: string,
  value: boolean,
): Promise<void> {
  await AsyncStorage.setItem(key, value ? '1' : '0');
}
